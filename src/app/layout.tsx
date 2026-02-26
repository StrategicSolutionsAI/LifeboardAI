import type { Metadata, Viewport } from 'next'
import { DM_Sans, Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'

import './globals.css'
import PerfObserver from '@/components/perf-observer'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Lifeboard.ai - Organize Your Life, Effortlessly With AI',
  description: 'The first emotion-first life-dashboard that fuses task, habit, and health data into one ruthlessly prioritised command centre.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${inter.variable}`}>
      <head>
        {/* Preconnect to external APIs used during page lifecycle */}
        <link rel="dns-prefetch" href="https://api.openai.com" />
        <link rel="dns-prefetch" href="https://api.open-meteo.com" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <PerfObserver />
          {children}
          <SpeedInsights />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
