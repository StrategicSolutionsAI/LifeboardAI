import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',
  
  // Configure error filtering for server-side
  beforeSend(event) {
    // Filter out known non-critical errors
    if (event.exception) {
      const error = event.exception.values?.[0];
      
      // Filter out common integration errors that are expected
      if (error?.value?.includes('invalid_token') && error?.value?.includes('Withings')) {
        return null; // Don't send Withings token expiration errors
      }
      
      if (error?.value?.includes('ECONNREFUSED') || error?.value?.includes('ENOTFOUND')) {
        // Only send network errors in production
        return process.env.NODE_ENV === 'production' ? event : null;
      }
    }
    
    return event;
  },
  
  // Set server context
  initialScope: {
    tags: {
      component: "server"
    }
  }
});
