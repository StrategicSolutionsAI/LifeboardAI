'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * Global error handler that catches unhandled promise rejections and
 * uncaught runtime errors on the client side, forwarding them to Sentry.
 *
 * Mount once in the root layout — it renders nothing visible.
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    function handleRejection(event: PromiseRejectionEvent) {
      // Avoid double-reporting if Sentry's own integration already caught it
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason ?? 'Unhandled promise rejection'))

      Sentry.captureException(error, {
        tags: { mechanism: 'onunhandledrejection' },
      })

      // eslint-disable-next-line no-console
      console.error('[GlobalErrorHandler] Unhandled promise rejection:', error)
    }

    function handleError(event: ErrorEvent) {
      if (event.error) {
        Sentry.captureException(event.error, {
          tags: { mechanism: 'onerror' },
        })
      }
    }

    window.addEventListener('unhandledrejection', handleRejection)
    window.addEventListener('error', handleError)

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection)
      window.removeEventListener('error', handleError)
    }
  }, [])

  return null
}
