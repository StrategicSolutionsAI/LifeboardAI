// Helper to keep Supabase cookies fresh on every request
// Based on https://supabase.com/docs/guides/auth/server-side/nextjs

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getUserCached } from '@/lib/server-auth-cache'
import { MIDDLEWARE_AUTH_TIMEOUT_MS } from '@/lib/cache-config'
import { authUnavailableResponse } from './auth-unavailable-response'

// Pages reachable without a session. Everything else redirects to /login.
// The /auth/ prefix must stay public — the OAuth callback at /auth/callback
// runs before cookies carry a user, so gating it would break Google login.
const PUBLIC_PATHS = ['/', '/login', '/signup', '/forgot-password', '/privacy', '/terms', '/error']
const PUBLIC_PREFIXES = ['/auth/']

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  )
}

export async function updateSession(request: NextRequest) {
  const nonce = generateNonce()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  let response = NextResponse.next({ request: { headers: requestHeaders } })
  let refreshedCookies = response.cookies.getAll()
  const finish = (result: NextResponse) => {
    result.headers.set('x-nonce', nonce)
    result.headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce))
    return result
  }

  // These pages don't consume a middleware user. The OAuth callback handles
  // its own exchange; an expired cookie must not delay the public site.
  if (isPublicPath(request.nextUrl.pathname)) return finish(response)

  const controller = new AbortController()
  const unavailable = () => {
    const result = authUnavailableResponse()
    // Keep a completed token rotation even if subsequent user validation
    // fails. Never send deletion-only batches caused by an auth outage.
    refreshedCookies.forEach(cookie => result.cookies.set(cookie))
    return finish(result)
  }
  let acceptingCookies = true
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      acceptingCookies = false
      reject(new Error('auth_timeout'))
      controller.abort()
    }, MIDDLEWARE_AUTH_TIMEOUT_MS)
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          fetch: async (input, init) => {
            // SDK retries can outlive the overall deadline. Never send another
            // request after it, and abort any in-flight network/body read.
            controller.signal.throwIfAborted()
            return fetch(input, { ...init, signal: controller.signal })
          },
        },
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            if (!acceptingCookies) return
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            // Refresh the copied header too, so Server Components receive the
            // rotated token rather than attempting a second refresh themselves.
            requestHeaders.set('cookie', request.headers.get('cookie') ?? '')
            const previousCookies = response.cookies.getAll()
            response = NextResponse.next({ request: { headers: requestHeaders } })
            previousCookies.forEach(cookie => response.cookies.set(cookie))
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
            if (cookiesToSet.some(({ value, options }) => value && options?.maxAge !== 0)) {
              refreshedCookies = response.cookies.getAll()
            }
          },
        },
      }
    )

    // Bound the whole operation, including getSession's refresh and SDK retry
    // backoff. A timeout on each individual fetch would still exceed 25s.
    const { data: { user }, error: authError } = await Promise.race([
      getUserCached(supabase),
      deadline,
    ])

    if (authError && (
      authError.name === 'AuthRetryableFetchError' ||
      authError.name === 'AuthUnknownError' ||
      authError.status === 429 ||
      (authError.status !== undefined && authError.status >= 500)
    )) {
      console.warn('[middleware] auth_unavailable', { pathname: request.nextUrl.pathname })
      return unavailable()
    }

    if (!user || authError) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.search = ''
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search)
      const redirect = NextResponse.redirect(loginUrl)
      response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
      return finish(redirect)
    }

    return finish(response)
  } catch {
    // Never log the exception: provider errors can contain URLs or credentials.
    console.warn(controller.signal.aborted ? '[middleware] auth_timeout' : '[middleware] auth_unavailable', {
      pathname: request.nextUrl.pathname,
    })
    return unavailable()
  } finally {
    acceptingCookies = false
    clearTimeout(timeoutId)
    controller.abort()
  }
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
