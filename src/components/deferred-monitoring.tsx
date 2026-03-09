'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { isElectron } from '@/lib/is-electron'

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
  const [inElectron, setInElectron] = useState(false)

  useEffect(() => {
    setInElectron(isElectron())
  }, [])

  // Lazy-load Sentry Session Replay after hydration to keep the replay
  // bundle (~30 KB) out of the critical shared chunk.
  useEffect(() => {
    if (inElectron) return
    import('@sentry/nextjs').then(Sentry => {
      const client = Sentry.getClient()
      if (client && !client.getIntegrationByName('Replay')) {
        Sentry.addIntegration(Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }))
      }
    })
  }, [inElectron])

  // Skip Vercel Analytics and SpeedInsights in Electron — they only work on Vercel
  if (inElectron) {
    return <PerfObserver />
  }

  return (
    <>
      <PerfObserver />
      <SpeedInsights />
      <Analytics />
    </>
  )
}
