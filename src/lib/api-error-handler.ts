import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export interface ApiError extends Error {
  statusCode?: number
  code?: string
  details?: any
}

export class CustomApiError extends Error implements ApiError {
  statusCode: number
  code?: string
  details?: any

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message)
    this.name = 'CustomApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export function createApiError(
  message: string, 
  statusCode: number = 500, 
  code?: string, 
  details?: any
): CustomApiError {
  return new CustomApiError(message, statusCode, code, details)
}

export function handleApiError(error: unknown, context?: string): NextResponse {
  console.error(`API Error ${context ? `in ${context}` : ''}:`, error)

  // Capture error in Sentry
  Sentry.withScope((scope) => {
    if (context) {
      scope.setTag('apiRoute', context)
    }
    scope.setLevel('error')
    
    if (error instanceof CustomApiError) {
      scope.setContext('errorDetails', {
        statusCode: error.statusCode,
        code: error.code,
        details: error.details
      })
    }
    
    Sentry.captureException(error)
  })

  // Handle different error types
  if (error instanceof CustomApiError) {
    return NextResponse.json(
      { 
        error: error.message, 
        code: error.code,
        ...(process.env.NODE_ENV === 'development' && error.details && { details: error.details })
      },
      { status: error.statusCode }
    )
  }

  // Handle known error patterns
  if (error instanceof Error) {
    // Database connection errors
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      return NextResponse.json(
        { error: 'Database connection failed', code: 'DB_CONNECTION_ERROR' },
        { status: 503 }
      )
    }

    // Authentication errors
    if (error.message.toLowerCase().includes('unauthorized') || 
        error.message.toLowerCase().includes('invalid token')) {
      return NextResponse.json(
        { error: 'Authentication failed', code: 'AUTH_ERROR' },
        { status: 401 }
      )
    }

    // Validation errors
    if (error.message.toLowerCase().includes('validation') ||
        error.message.toLowerCase().includes('invalid input')) {
      return NextResponse.json(
        { error: error.message, code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
  }

  // Default error response
  const isDevelopment = process.env.NODE_ENV === 'development'
  return NextResponse.json(
    { 
      error: isDevelopment && error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    },
    { status: 500 }
  )
}

export function withErrorHandling(
  handler: (request: Request, ...args: any[]) => Promise<NextResponse>,
  context?: string
) {
  return async (request: Request, ...args: any[]): Promise<NextResponse> => {
    try {
      return await handler(request, ...args)
    } catch (error) {
      return handleApiError(error, context)
    }
  }
}

// Utility for async operations with error handling
export async function safeApiCall<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<{ data?: T; error?: CustomApiError }> {
  try {
    const data = await operation()
    return { data }
  } catch (error) {
    console.error(`SafeApiCall error ${context ? `in ${context}` : ''}:`, error)
    
    Sentry.withScope((scope) => {
      if (context) {
        scope.setTag('safeApiCall', context)
      }
      Sentry.captureException(error)
    })

    if (error instanceof CustomApiError) {
      return { error }
    }

    return { 
      error: new CustomApiError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        500,
        'SAFE_API_CALL_ERROR'
      )
    }
  }
}