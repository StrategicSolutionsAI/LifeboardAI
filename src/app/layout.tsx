import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'


export const metadata: Metadata = {
  title: 'Lifeboard.ai - Organize Your Life, Effortlessly With AI',
  description: 'The first emotion-first life-dashboard that fuses task, habit, and health data into one ruthlessly prioritised command centre.',
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
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
