import type { Metadata, Viewport } from 'next'
import { DM_Sans, Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'
import { GlobalErrorHandler } from '@/components/global-error-handler'
import { ToastProvider } from '@/components/ui/use-toast'
import { DeferredMonitoring } from '@/components/deferred-monitoring'

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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lifeboard.ai'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Lifeboard.ai - Organize Your Life, Effortlessly With AI',
    template: '%s | Lifeboard.ai',
  },
  description:
    'The first emotion-first life-dashboard that fuses task, habit, and health data into one ruthlessly prioritised command centre.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lifeboard',
  },
  openGraph: {
    type: 'website',
    siteName: 'Lifeboard.ai',
    title: 'Lifeboard.ai - Organize Your Life, Effortlessly With AI',
    description:
      'The first emotion-first life-dashboard that fuses task, habit, and health data into one ruthlessly prioritised command centre.',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lifeboard.ai - Organize Your Life, Effortlessly With AI',
    description:
      'The first emotion-first life-dashboard that fuses task, habit, and health data into one ruthlessly prioritised command centre.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#B1916A',
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
        {/* Apple splash screen images (eliminates white flash on iOS PWA launch) */}
        <link rel="apple-touch-startup-image" href="/splash/iphone-se-640x1136.png" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-8-750x1334.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-x-1125x2436.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-xr-828x1792.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-12-1170x2532.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-14pro-1179x2556.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-15promax-1290x2796.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/splash/iphone-16promax-1320x2868.png" media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)" />
        {/* Register service worker for PWA */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}`
          }}
        />
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
          <ToastProvider>
            <GlobalErrorHandler />
            {children}
          </ToastProvider>
          <DeferredMonitoring />
        </ThemeProvider>
      </body>
    </html>
  )
}
