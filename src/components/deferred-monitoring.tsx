'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'

const PerfObserver = dynamic(() => import('@/components/perf-observer'), { ssr: false })
const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/next').then(m => m.SpeedInsights),
  { ssr: false }
)
const Analytics = dynamic(
  () => import('@vercel/analytics/next').then(m => m.Analytics),
  { ssr: false }
)

export function DeferredMonitoring() {
  // Lazy-load Sentry Session Replay after hydration to keep the replay
  // bundle (~30 KB) out of the critical shared chunk.
  useEffect(() => {
    import('@sentry/nextjs').then(Sentry => {
      const client = Sentry.getClient()
      if (client && !client.getIntegrationByName('Replay')) {
        Sentry.addIntegration(Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }))
      }
    })
  }, [])

  return (
    <>
      <PerfObserver />
      <SpeedInsights />
      <Analytics />
    </>
  )
}
