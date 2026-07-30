'use client'

import NextError from 'next/error'
import { useEffect } from 'react'
import { ensureSentry } from '@/lib/sentry-lazy'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    ensureSentry().then(Sentry => Sentry.captureException(error))
  }, [error])

  return (
    <html>
      <body>
        {/* This is the default Next.js error component */}
        <NextError statusCode={undefined as any} />
      </body>
    </html>
  )
}