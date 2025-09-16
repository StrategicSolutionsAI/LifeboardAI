import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'
import PerfObserver from '@/components/perf-observer'


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
    <html lang="en">
      <body className="font-sans antialiased">
        <ThemeProvider>
          <PerfObserver />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
