type SentryModule = typeof import('@sentry/nextjs')

let pending: Promise<SentryModule> | null = null

/**
 * Loads and initializes the Sentry browser SDK, at most once.
 *
 * The SDK is ~109 kB gzip. Calling `Sentry.init()` at module scope in
 * `instrumentation-client.ts` put it in the client entry chunk, so every route
 * paid it in First Load JS (65% of the 167 kB shared baseline). Loading it
 * through a dynamic import keeps it in its own async chunk instead.
 *
 * Init lives here rather than in the caller because `captureException` is a
 * silent no-op when no client has been initialized — so every call site that
 * reports to Sentry has to be able to force init, not just force the import.
 */
export function ensureSentry(): Promise<SentryModule> {
  if (!pending) {
    pending = import('@sentry/nextjs').then((Sentry) => {
      if (!Sentry.getClient()) {
        Sentry.init({
          dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
          tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
          replaysOnErrorSampleRate: 1.0,
          replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.1,
          // Replay integration is added after hydration (see deferred-monitoring.tsx)
          // to keep the replay bundle out of this chunk too.
          beforeSend(event) {
            if (event.exception) {
              const error = event.exception.values?.[0]
              if (error?.value?.includes('ResizeObserver loop limit exceeded')) return null
              if (error?.value?.includes('Non-Error promise rejection')) return null
            }
            return event
          },
          initialScope: { tags: { component: 'client' } },
        })
      }
      return Sentry
    })
  }
  return pending
}
