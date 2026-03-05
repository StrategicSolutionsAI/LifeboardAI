import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.1,
  // Replay integration is lazy-loaded after hydration (see deferred-monitoring.tsx)
  // to keep it out of the critical shared chunk.
  beforeSend(event) {
    if (event.exception) {
      const error = event.exception.values?.[0];
      if (error?.value?.includes('ResizeObserver loop limit exceeded')) return null;
      if (error?.value?.includes('Non-Error promise rejection')) return null;
    }
    return event;
  },
  initialScope: { tags: { component: "client" } },
});

// Required for Sentry navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
