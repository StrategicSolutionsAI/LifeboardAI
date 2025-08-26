// Helper to keep Supabase cookies fresh on every request
// Based on https://supabase.com/docs/guides/auth/server-side/nextjs

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } })

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
  return response
}
