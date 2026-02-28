'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'
import { AlertCircle, RotateCcw, Home } from 'lucide-react'
import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AppError({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-theme-surface-raised p-8 text-center shadow-warm">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-red-50 p-3">
            <AlertCircle className="h-8 w-8 text-red-500" aria-hidden="true" />
          </div>
        </div>

        <h1 className="mb-2 text-2xl font-semibold text-theme-text-primary">
          Something went wrong
        </h1>

        <p className="mb-6 text-theme-text-secondary">
          {error.digest
            ? 'An unexpected error occurred. Our team has been notified.'
            : error.message || 'An unexpected error occurred.'}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => reset()}
            className="flex-1 gap-2 bg-theme-primary text-white hover:bg-theme-primary/90"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
          <Button asChild variant="outline" className="flex-1 gap-2">
            <Link href="/dashboard">
              <Home className="h-4 w-4" aria-hidden="true" />
              Go to Dashboard
            </Link>
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 rounded-lg bg-red-50 p-3 text-left">
            <summary className="cursor-pointer text-sm font-medium text-red-700">
              Error details (dev only)
            </summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-red-600">
              {error.stack || error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
