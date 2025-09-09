// Removed NextRequest import as we now use standard Request
import * as Sentry from '@sentry/nextjs'

export interface LogContext {
  requestId?: string
  userId?: string
  route?: string
  integration?: string
  operation?: string
  [key: string]: any
}

export interface StructuredLogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

class Logger {
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private createLogEntry(
    level: StructuredLogEntry['level'],
    message: string,
    context: LogContext = {},
    error?: Error
  ): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        requestId: context.requestId || this.generateRequestId()
      }
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }

    return entry
  }

  private log(entry: StructuredLogEntry) {
    const logString = JSON.stringify(entry)
    
    // Send to Sentry for errors and warnings
    if (entry.level === 'error' || entry.level === 'warn') {
      Sentry.withScope((scope) => {
        scope.setLevel(entry.level === 'error' ? 'error' : 'warning')
        scope.setContext('logContext', entry.context)
        
        if (entry.error) {
          scope.setTag('errorName', entry.error.name)
        }
        
        if (entry.context.requestId) {
          scope.setTag('requestId', entry.context.requestId)
        }
        
        if (entry.context.userId) {
          scope.setUser({ id: entry.context.userId })
        }
        
        if (entry.context.integration) {
          scope.setTag('integration', entry.context.integration)
        }

        Sentry.captureMessage(entry.message, entry.level === 'error' ? 'error' : 'warning')
      })
    }

    // Console output with appropriate method
    switch (entry.level) {
      case 'error':
        console.error(logString)
        break
      case 'warn':
        console.warn(logString)
        break
      case 'info':
        console.info(logString)
        break
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(logString)
        }
        break
    }
  }

  debug(message: string, context?: LogContext) {
    this.log(this.createLogEntry('debug', message, context))
  }

  info(message: string, context?: LogContext) {
    this.log(this.createLogEntry('info', message, context))
  }

  warn(message: string, context?: LogContext, error?: Error) {
    this.log(this.createLogEntry('warn', message, context, error))
  }

  error(message: string, context?: LogContext, error?: Error) {
    this.log(this.createLogEntry('error', message, context, error))
  }

  // Create a scoped logger for a specific request
  forRequest(request: Request, additionalContext?: LogContext): ScopedLogger {
    const requestId = request.headers.get('x-request-id') || this.generateRequestId()
    const url = new URL(request.url)
    const route = url.pathname
    
    const baseContext: LogContext = {
      requestId,
      route,
      method: request.method,
      userAgent: request.headers.get('user-agent') || undefined,
      ...additionalContext
    }

    return new ScopedLogger(this, baseContext)
  }

  // Create a scoped logger for integration operations
  forIntegration(integration: string, context?: LogContext): ScopedLogger {
    const baseContext: LogContext = {
      integration,
      ...context
    }

    return new ScopedLogger(this, baseContext)
  }
}

class ScopedLogger {
  constructor(
    private logger: Logger,
    public readonly baseContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.baseContext, ...context }
  }

  debug(message: string, context?: LogContext) {
    this.logger.debug(message, this.mergeContext(context))
  }

  info(message: string, context?: LogContext) {
    this.logger.info(message, this.mergeContext(context))
  }

  warn(message: string, context?: LogContext, error?: Error) {
    this.logger.warn(message, this.mergeContext(context), error)
  }

  error(message: string, context?: LogContext, error?: Error) {
    this.logger.error(message, this.mergeContext(context), error)
  }

  // Helper method to log API call start
  apiCallStart(operation: string, details?: any) {
    this.info(`Starting ${operation}`, {
      operation,
      stage: 'start',
      ...details
    })
  }

  // Helper method to log API call success
  apiCallSuccess(operation: string, details?: any) {
    this.info(`Completed ${operation}`, {
      operation,
      stage: 'success',
      ...details
    })
  }

  // Helper method to log API call failure
  apiCallError(operation: string, error: Error, details?: any) {
    this.error(`Failed ${operation}`, {
      operation,
      stage: 'error',
      ...details
    }, error)
  }

  // Helper method for timing operations
  async timeOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now()
    this.info(`Starting ${operation}`, { ...context, operation, stage: 'start' })

    try {
      const result = await fn()
      const duration = Date.now() - startTime
      this.info(`Completed ${operation}`, {
        ...context,
        operation,
        stage: 'success',
        duration
      })
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.error(`Failed ${operation}`, {
        ...context,
        operation,
        stage: 'error',
        duration
      }, error as Error)
      throw error
    }
  }
}

// Export singleton instance
export const logger = new Logger()
export type { ScopedLogger }