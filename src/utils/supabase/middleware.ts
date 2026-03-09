// Helper to keep Supabase cookies fresh on every request
// Based on https://supabase.com/docs/guides/auth/server-side/nextjs

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function updateSession(request: NextRequest) {
  const nonce = generateNonce()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        // The `set` and `remove` helpers accept an `opts` bag for expiry, path, etc.
        // The `cookies.set()` typings currently only allow 2 params, so we suppress here.
        set(name: string, value: string, opts: any) {
          // eslint-disable-next-line
          (request.cookies as any).set(name, value, opts)
          // eslint-disable-next-line
          (response.cookies as any).set(name, value, opts)
        },
        remove(name: string, opts: any) {
          // eslint-disable-next-line
          (request.cookies as any).set(name, '', opts)
          // eslint-disable-next-line
          (response.cookies as any).set(name, '', opts)
        },
      },
    }
  )

  await supabase.auth.getSession()
  response.headers.set('x-nonce', nonce)
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce))
  return response
}

function generateNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const array = crypto.getRandomValues(new Uint8Array(16))

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(array).toString('base64')
    }

    let binary = ''
    array.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })

    if (typeof btoa === 'function') {
      return btoa(binary)
    }

    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  return Math.random().toString(36).slice(2, 18)
}

// Cache the static CSP template — only the nonce changes per request
let cachedCspTemplate: string | null = null

function getCspTemplate(): string {
  if (cachedCspTemplate) return cachedCspTemplate

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseHost = (() => {
    try {
      return supabaseUrl ? new URL(supabaseUrl).host : undefined
    } catch {
      return undefined
    }
  })()

  const scriptSrc = [
    "'self'",
    "'wasm-unsafe-eval'",
    "'inline-speculation-rules'",
    'NONCE_PLACEHOLDER',
    'https://va.vercel-scripts.com',
  ]

  if (process.env.NODE_ENV !== 'production') {
    scriptSrc.push("'unsafe-eval'")
  }

  const connectSrc = [
    "'self'",
    'https://va.vercel-scripts.com',
    'https://api.openai.com',
    'https://api.open-meteo.com',
    'https://oauth2.googleapis.com',
    'https://www.googleapis.com',
    'https://accounts.google.com',
  ]

  if (supabaseHost) {
    connectSrc.push(`https://${supabaseHost}`, `wss://${supabaseHost}`)
  }

  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    'https://placekitten.com',
  ]

  if (supabaseHost) {
    imgSrc.push(`https://${supabaseHost}`)
  }

  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `frame-ancestors 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `script-src ${scriptSrc.join(' ')}`,
    `style-src 'self' 'unsafe-inline'`,
    `font-src 'self' data:`,
    `img-src ${imgSrc.join(' ')}`,
    `connect-src ${connectSrc.join(' ')}`,
    `frame-src 'self' https://accounts.google.com`,
    `media-src 'self' blob:`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    // Skip upgrade-insecure-requests in Electron — the app runs over HTTP on localhost
    ...(process.env.ELECTRON_MODE ? [] : [`upgrade-insecure-requests`]),
  ]

  cachedCspTemplate = directives.join('; ')
  return cachedCspTemplate
}

function buildContentSecurityPolicy(nonce: string): string {
  return getCspTemplate().replace('NONCE_PLACEHOLDER', `'nonce-${nonce}'`)
}
