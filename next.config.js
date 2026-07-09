const { withSentryConfig } = require('@sentry/nextjs');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]
    : []),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [],
  },
  experimental: {
    instrumentationHook: true,
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-tabs',
      '@radix-ui/react-checkbox',
      'framer-motion',
      'recharts',
    ],
    // Keep visited dynamic pages in the client router cache for 5 minutes
    // (default is 30s). Every (app) page is a static client shell whose data
    // comes from client-side caches, so re-navigation can skip the RSC round
    // trip. Session expiry stays safe: API calls still 401 and set the
    // x-session-expired header.
    staleTimes: {
      dynamic: 300,
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  webpack: (config, { isServer }) => {
    // Suppress critical dependency warnings for @supabase/realtime-js
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /node_modules\/@supabase\/realtime-js/,
        message: /Critical dependency/,
      },
    ];
    
    return config;
  },
}

module.exports = withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  automaticVercelMonitors: true,

  // Tree-shake unused Sentry Replay features to reduce bundle size
  webpack: {
    treeshake: {
      removeDebugLogging: true,
      excludeReplayIframe: true,
      excludeReplayShadowDOM: true,
    },
  },
});
