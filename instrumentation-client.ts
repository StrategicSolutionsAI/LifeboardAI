import { ensureSentry } from '@/lib/sentry-lazy'

// Sentry's browser SDK is ~109 kB gzip. Importing it here at module scope put it
// in the client entry chunk (rootMainFiles), so all 49 route entries paid it in
// First Load JS. Kicking the load off when the browser goes idle keeps it off
// the critical path; anything that needs to report sooner — GlobalErrorHandler,
// the error boundaries — calls ensureSentry() itself and forces the load then.
if (typeof window !== 'undefined') {
  const start = () => {
    void ensureSentry()
  }
  // typeof-guard rather than `'requestIdleCallback' in window`: lib.dom declares
  // the method unconditionally, so an `in` check narrows the else branch to never.
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(start, { timeout: 4000 })
  } else {
    window.setTimeout(start, 2000)
  }
}

// Sentry's navigation instrumentation hook. Next.js only calls this from 15.3
// onward (this app is on 14.2), so it is currently inert — kept as a lazy
// forwarder so it starts working on upgrade without dragging the SDK back into
// the entry chunk.
export function onRouterTransitionStart(
  ...args: Parameters<typeof import('@sentry/nextjs').captureRouterTransitionStart>
) {
  void ensureSentry().then((Sentry) => Sentry.captureRouterTransitionStart(...args))
}
