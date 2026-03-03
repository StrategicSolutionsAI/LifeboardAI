import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { CustomApiError, createApiError } from './api-error-handler'
import { logger, LogContext, ScopedLogger } from './logger'
import { withRefreshLock } from './token-refresh-lock'

export interface IntegrationError extends CustomApiError {
  provider: string
  needsReauth?: boolean
  retryAfter?: number
}

export interface TokenRefreshResult {
  success: boolean
  newTokens?: {
    access_token: string
    refresh_token?: string
    token_data?: any
  }
  error?: IntegrationError
}

export interface IntegrationContext {
  provider: string
  userId: string
  integrationId: string
  operation: string
}

export class IntegrationErrorHandler {
  private logger: ScopedLogger

  constructor(context: IntegrationContext) {
    this.logger = logger.forIntegration(context.provider, {
      userId: context.userId,
      integrationId: context.integrationId,
      operation: context.operation
    })
  }

  // Handle common integration errors with standardized responses
  handleError(error: unknown, context?: LogContext): NextResponse {
    this.logger.error('Integration error occurred', context, error as Error)

    if (this.isIntegrationError(error)) {
      return this.createErrorResponse(error)
    }

    if (error instanceof Error) {
      const integrationError = this.categorizeError(error)
      return this.createErrorResponse(integrationError)
    }

    // Fallback for unknown errors
    const fallbackError = createApiError(
      'An unexpected error occurred',
      500,
      'UNKNOWN_ERROR'
    ) as IntegrationError
    fallbackError.provider = this.logger.baseContext.integration || 'unknown'
    
    return this.createErrorResponse(fallbackError)
  }

  private isIntegrationError(error: unknown): error is IntegrationError {
    return error instanceof Error && 
           'provider' in error && 
           typeof (error as any).provider === 'string'
  }

  private categorizeError(error: Error): IntegrationError {
    const provider = this.logger.baseContext.integration || 'unknown'
    
    // Token/Authentication errors
    if (this.isTokenError(error)) {
      const integrationError = createApiError(
        `${provider} authentication expired - please reconnect your account`,
        401,
        'TOKEN_EXPIRED'
      ) as IntegrationError
      integrationError.provider = provider
      integrationError.needsReauth = true
      return integrationError
    }

    // Rate limiting errors
    if (this.isRateLimitError(error)) {
      const retryAfter = this.extractRetryAfter(error)
      const integrationError = createApiError(
        `${provider} rate limit exceeded - please try again later`,
        429,
        'RATE_LIMITED'
      ) as IntegrationError
      integrationError.provider = provider
      integrationError.retryAfter = retryAfter
      return integrationError
    }

    // Network/connectivity errors
    if (this.isNetworkError(error)) {
      const integrationError = createApiError(
        `${provider} service temporarily unavailable`,
        503,
        'SERVICE_UNAVAILABLE'
      ) as IntegrationError
      integrationError.provider = provider
      return integrationError
    }

    // Validation errors
    if (this.isValidationError(error)) {
      const integrationError = createApiError(
        error.message,
        400,
        'VALIDATION_ERROR'
      ) as IntegrationError
      integrationError.provider = provider
      return integrationError
    }

    // Default to internal error
    const integrationError = createApiError(
      `${provider} integration error: ${error.message}`,
      500,
      'INTEGRATION_ERROR'
    ) as IntegrationError
    integrationError.provider = provider
    return integrationError
  }

  private isTokenError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return message.includes('invalid_token') ||
           message.includes('token expired') ||
           message.includes('unauthorized') ||
           message.includes('authentication failed') ||
           error.message === 'INVALID_TOKEN' ||
           error.message === 'REFRESH_TOKEN_EXPIRED'
  }

  private isRateLimitError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return message.includes('rate limit') ||
           message.includes('too many requests') ||
           message.includes('quota exceeded') ||
           error.message === 'RATE_LIMITED'
  }

  private isNetworkError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return message.includes('econnrefused') ||
           message.includes('enotfound') ||
           message.includes('timeout') ||
           message.includes('network error') ||
           message.includes('fetch failed')
  }

  private isValidationError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return message.includes('validation') ||
           message.includes('invalid input') ||
           message.includes('bad request')
  }

  private extractRetryAfter(error: Error): number | undefined {
    // Try to extract retry-after value from error message
    const match = error.message.match(/retry.?after[:\s]*(\d+)/i)
    return match ? parseInt(match[1]) : undefined
  }

  private createErrorResponse(error: IntegrationError): NextResponse {
    const response: any = {
      error: error.message,
      code: error.code,
      provider: error.provider
    }

    if (error.needsReauth) {
      response.needsReauth = true
    }

    if (error.retryAfter) {
      response.retryAfter = error.retryAfter
    }

    if (process.env.NODE_ENV === 'development' && error.details) {
      response.details = error.details
    }

    const headers: Record<string, string> = {}
    if (error.retryAfter) {
      headers['Retry-After'] = error.retryAfter.toString()
    }

    return NextResponse.json(response, { 
      status: error.statusCode || 500,
      headers
    })
  }

  // Helper method to handle token refresh operations.
  // Uses an in-memory lock to prevent concurrent refreshes for the same
  // integration from racing (important because Withings rotates refresh tokens).
  async handleTokenRefresh<T>(
    refreshTokenFn: (refreshToken: string) => Promise<T>,
    refreshToken: string,
    integrationId: string
  ): Promise<TokenRefreshResult> {
    if (!refreshToken) {
      this.logger.warn('No refresh token available for token refresh')
      return {
        success: false,
        error: createApiError(
          'No refresh token available - please reconnect your account',
          401,
          'NO_REFRESH_TOKEN'
        ) as IntegrationError
      }
    }

    return withRefreshLock(integrationId, async () => {
      try {
        // Re-read the integration row inside the lock — another request may
        // have already refreshed while we were waiting.
        const supabase = supabaseServer()
        const { data: freshRow } = await supabase
          .from('user_integrations')
          .select('access_token, refresh_token, token_data, updated_at')
          .eq('id', integrationId)
          .maybeSingle()

        if (freshRow?.updated_at) {
          const updatedMs = new Date(freshRow.updated_at).getTime()
          const tokenData = (freshRow.token_data || {}) as { expires_in?: number }
          const expiresIn = (tokenData.expires_in ?? 3600) * 1000
          const isStillFresh = Date.now() < updatedMs + expiresIn - 60_000

          if (isStillFresh && freshRow.access_token) {
            this.logger.info('Token already refreshed by another request', { integrationId })
            return {
              success: true,
              newTokens: {
                access_token: freshRow.access_token,
                refresh_token: freshRow.refresh_token ?? undefined,
                token_data: freshRow.token_data
              }
            }
          }
        }

        // Use the latest refresh token from the DB (may have been rotated).
        const latestRefreshToken = freshRow?.refresh_token || refreshToken

        this.logger.info('Attempting token refresh', { integrationId })
        const newTokens = await refreshTokenFn(latestRefreshToken)

        const { error: updateError } = await supabase
          .from('user_integrations')
          .update({
            access_token: (newTokens as any).access_token,
            refresh_token: (newTokens as any).refresh_token || latestRefreshToken,
            token_data: newTokens,
            updated_at: new Date().toISOString(),
          })
          .eq('id', integrationId)

        if (updateError) {
          this.logger.error('Failed to update tokens in database', {}, updateError)
          throw updateError
        }

        this.logger.info('Token refresh successful', { integrationId })

        return {
          success: true,
          newTokens: {
            access_token: (newTokens as any).access_token,
            refresh_token: (newTokens as any).refresh_token,
            token_data: newTokens
          }
        }
      } catch (error) {
        this.logger.error('Token refresh failed', { integrationId }, error as Error)

        const integrationError = this.categorizeError(error as Error)

        // Only clear tokens if the refresh token itself is permanently invalid.
        // Re-check the DB first — another request may have refreshed successfully.
        if (integrationError.code === 'TOKEN_EXPIRED') {
          const supabase = supabaseServer()
          const { data: currentRow } = await supabase
            .from('user_integrations')
            .select('updated_at')
            .eq('id', integrationId)
            .maybeSingle()

          const recentlyUpdated = currentRow?.updated_at &&
            (Date.now() - new Date(currentRow.updated_at).getTime()) < 30_000

          if (!recentlyUpdated) {
            await this.clearInvalidTokens(integrationId)
          } else {
            this.logger.info('Skipping token clear — row was recently updated by another request', { integrationId })
          }
        }

        return {
          success: false,
          error: integrationError
        }
      }
    })
  }

  // Clear invalid tokens from database
  private async clearInvalidTokens(integrationId: string): Promise<void> {
    try {
      const supabase = supabaseServer()
      await supabase
        .from('user_integrations')
        .update({
          access_token: null,
          refresh_token: null,
          token_data: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integrationId)
        
      this.logger.info('Cleared invalid tokens from database', { integrationId })
    } catch (error) {
      this.logger.error('Failed to clear invalid tokens', { integrationId }, error as Error)
    }
  }

  // Wrapper for integration API calls with automatic retry logic
  async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number
      retryDelay?: number
      retryableErrors?: string[]
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      retryableErrors = ['RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'TIMEOUT']
    } = options

    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug('Attempting operation', { 
          attempt, 
          maxRetries,
          operation: this.logger.baseContext.operation 
        })
        
        const result = await operation()
        
        if (attempt > 1) {
          this.logger.info('Operation succeeded after retry', { 
            attempt,
            operation: this.logger.baseContext.operation 
          })
        }
        
        return result
      } catch (error) {
        lastError = error as Error
        
        const shouldRetry = attempt < maxRetries && 
          retryableErrors.some(code => lastError?.message.includes(code))
        
        if (!shouldRetry) {
          this.logger.error('Operation failed, no more retries', {
            attempt,
            maxRetries,
            operation: this.logger.baseContext.operation
          }, lastError)
          break
        }

        this.logger.warn('Operation failed, retrying', {
          attempt,
          maxRetries,
          retryDelay,
          operation: this.logger.baseContext.operation
        }, lastError)

        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)))
      }
    }

    throw lastError || new Error('Operation failed after all retries')
  }
}

// Utility function to create integration error handler
export function createIntegrationErrorHandler(context: IntegrationContext): IntegrationErrorHandler {
  return new IntegrationErrorHandler(context)
}