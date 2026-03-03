import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { fetchWithingsLatestWeight, refreshWithingsToken } from '@/lib/withings/client'
import { logger } from '@/lib/logger'
import { createIntegrationErrorHandler } from '@/lib/integration-error-handler'
import { withErrorHandling } from '@/lib/api-error-handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function handler(request: Request) {
  // For logger compatibility, we can pass request directly
  const nextRequest = request
  const requestLogger = logger.forRequest(nextRequest, { operation: 'get-withings-metrics' })
  
  requestLogger.info('Starting Withings metrics request')
  
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let effectiveUser = user

  if (!effectiveUser) {
    // Sometimes getUser() returns null because cookies are split; fallback to getSession()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user) {
      effectiveUser = session.user
    }
  }

  if (!effectiveUser) {
    requestLogger.warn('Request without authentication')
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  requestLogger.debug('User authenticated', { userId: effectiveUser.id })

  // Fetch integration row — use order + limit to handle potential duplicates
  const { data: integrations, error: integrationError } = await supabase
    .from('user_integrations')
    .select('id, access_token, refresh_token, token_data, updated_at')
    .eq('user_id', effectiveUser.id)
    .eq('provider', 'withings')
    .order('updated_at', { ascending: false })
    .limit(1)

  if (integrationError) {
    requestLogger.error('Failed to fetch integration', { userId: effectiveUser.id }, integrationError)
    return NextResponse.json({ error: 'Failed to fetch integration' }, { status: 500 })
  }

  const integration = integrations?.[0] ?? null

  if (!integration?.access_token) {
    requestLogger.warn('Withings integration not found or missing token', { userId: effectiveUser.id })
    return NextResponse.json({ error: 'Withings not connected' }, { status: 400 })
  }

  // Create integration-specific error handler
  const errorHandler = createIntegrationErrorHandler({
    provider: 'withings',
    userId: effectiveUser.id,
    integrationId: integration.id,
    operation: 'get-metrics'
  })

  requestLogger.info('Integration found', { 
    integrationId: integration.id,
    hasAccessToken: !!integration.access_token,
    hasRefreshToken: !!integration.refresh_token
  })

  let accessToken = integration.access_token
  const refreshToken = integration.refresh_token ?? ''

  // Check token expiry and refresh if needed
  try {
    const tokenData = (integration.token_data || {}) as { expires_in?: number }
    if (tokenData.expires_in && integration.updated_at) {
      const updated = new Date(integration.updated_at).getTime()
      const expiresAt = updated + tokenData.expires_in * 1000
      const willExpireSoon = Date.now() > expiresAt - 60 * 1000
      
      if (willExpireSoon) {
        requestLogger.info('Token will expire soon, refreshing preemptively', {
          expiresAt: new Date(expiresAt).toISOString(),
          integrationId: integration.id
        })
        
        const refreshResult = await errorHandler.handleTokenRefresh(
          refreshWithingsToken,
          refreshToken,
          integration.id
        )
        
        if (refreshResult.success && refreshResult.newTokens) {
          accessToken = refreshResult.newTokens.access_token
          requestLogger.info('Token refreshed successfully', { integrationId: integration.id })
        } else if (refreshResult.error) {
          requestLogger.warn('Preemptive token refresh failed, will try with current token', {
            integrationId: integration.id
          }, refreshResult.error)
          // Continue with current token - might still work
        }
      }
    }
  } catch (e) {
    requestLogger.warn('Error during token expiry check', { integrationId: integration.id }, e as Error)
    // Continue with current token
  }

  // Fetch metrics with retry logic and error handling
  try {
    const weightKg = await errorHandler.withRetry(async () => {
      return await requestLogger.timeOperation('fetch-withings-weight', async () => {
        return await fetchWithingsLatestWeight(accessToken)
      })
    })
    
    // NOTE: We intentionally do NOT update `updated_at` here.
    // `updated_at` tracks when the *token* was last refreshed, which is used
    // to calculate token expiry.  Bumping it on every data fetch would mask
    // the real token age and delay preemptive refresh.

    requestLogger.info('Successfully fetched Withings metrics', {
      integrationId: integration.id,
      weightKg
    })
    
    return NextResponse.json({ weightKg })
    
  } catch (error) {
    // Handle token errors with automatic refresh
    if (error instanceof Error && error.message === 'INVALID_TOKEN') {
      requestLogger.warn('Invalid token detected, attempting refresh', {
        integrationId: integration.id
      })
      
      const refreshResult = await errorHandler.handleTokenRefresh(
        refreshWithingsToken,
        refreshToken,
        integration.id
      )
      
      if (refreshResult.success && refreshResult.newTokens) {
        // Retry with new token
        try {
          const weightKg = await requestLogger.timeOperation('fetch-withings-weight-retry', async () => {
            return await fetchWithingsLatestWeight(refreshResult.newTokens!.access_token)
          })
          
          requestLogger.info('Successfully fetched Withings metrics after token refresh', {
            integrationId: integration.id,
            weightKg
          })
          
          return NextResponse.json({ weightKg })
          
        } catch (retryError) {
          requestLogger.error('Failed to fetch metrics even after token refresh', {
            integrationId: integration.id
          }, retryError as Error)
          return errorHandler.handleError(retryError)
        }
      } else {
        // Token refresh failed
        return errorHandler.handleError(refreshResult.error || error)
      }
    }
    
    // Handle other errors
    return errorHandler.handleError(error)
  }
}

export const GET = withErrorHandling(handler, 'withings-metrics') 
