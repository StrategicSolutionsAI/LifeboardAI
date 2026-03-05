'use client'

import { useEffect } from 'react'

// Lazy-loaded Sentry — avoids pulling the full SDK into the shared chunk
let _sentry: Promise<typeof import('@sentry/nextjs')> | null = null
function getSentry() {
  if (!_sentry) {
    _sentry = import('@sentry/nextjs')
  }
  return _sentry
}

/**
 * Global error handler that catches unhandled promise rejections and
 * uncaught runtime errors on the client side, forwarding them to Sentry.
 *
 * Mount once in the root layout — it renders nothing visible.
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    function handleRejection(event: PromiseRejectionEvent) {
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason ?? 'Unhandled promise rejection'))

      getSentry().then(Sentry => {
        Sentry.captureException(error, {
          tags: { mechanism: 'onunhandledrejection' },
        })
      })

      // eslint-disable-next-line no-console
      console.error('[GlobalErrorHandler] Unhandled promise rejection:', error)
    }

    function handleError(event: ErrorEvent) {
      if (event.error) {
        getSentry().then(Sentry => {
          Sentry.captureException(event.error, {
            tags: { mechanism: 'onerror' },
          })
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
