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
        {/*
          Inline theme script: injects a <style> tag with CSS custom properties
          from localStorage BEFORE React hydrates, preventing the blank flash
          caused by the ThemeProvider waiting for useEffect.
          Uses a <style> tag (not inline styles) to avoid hydration mismatch
          on the <html> element.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{function h2r(h){var r=/^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(h);return r?[parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)]:null}function r2h(r,g,b){return"#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}function li(c,a){var rgb=h2r(c);if(!rgb)return c;return r2h(Math.min(255,Math.round(rgb[0]+(255-rgb[0])*a)),Math.min(255,Math.round(rgb[1]+(255-rgb[1])*a)),Math.min(255,Math.round(rgb[2]+(255-rgb[2])*a)))}function dk(c,a){var rgb=h2r(c);if(!rgb)return c;return r2h(Math.max(0,Math.round(rgb[0]*(1-a))),Math.max(0,Math.round(rgb[1]*(1-a))),Math.max(0,Math.round(rgb[2]*(1-a))))}var t;try{var s=localStorage.getItem("theme_colors");if(s)t=JSON.parse(s)}catch(e){}if(!t)t={primary:"#B1916A",secondary:"#bb9e7b",accent:"#dbd6cf"};var p=t.primary,sc=t.secondary,la=[0.9,0.8,0.6,0.4,0.2],da=[0.1,0.2,0.3,0.4,0.5],ns=["50","100","200","300","400"],nd=["600","700","800","900","950"];var css=":root{--theme-primary:"+p+";--theme-secondary:"+sc+";--theme-accent:"+t.accent+";--theme-primary-500:"+p+";--theme-secondary-500:"+sc+";";for(var i=0;i<5;i++){css+="--theme-primary-"+ns[i]+":"+li(p,la[i])+";";css+="--theme-secondary-"+ns[i]+":"+li(sc,la[i])+";";}for(var j=0;j<5;j++){css+="--theme-primary-"+nd[j]+":"+dk(p,da[j])+";";css+="--theme-secondary-"+nd[j]+":"+dk(sc,da[j])+";";}css+="}";var el=document.createElement("style");el.id="theme-vars";el.textContent=css;document.head.appendChild(el)}catch(e){}})()`
          }}
        />
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
