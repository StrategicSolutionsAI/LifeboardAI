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
        /* eslint-disable @typescript-eslint/ban-ts-comment */
        set(name: string, value: string, opts: any) {
          // @ts-ignore – third param opts is supported at runtime
          request.cookies.set(name, value, opts)
          // @ts-ignore
          response.cookies.set(name, value, opts)
        },
        remove(name: string, opts: any) {
          // @ts-ignore
          request.cookies.set(name, '', opts)
          // @ts-ignore
          response.cookies.set(name, '', opts)
        },
        /* eslint-enable @typescript-eslint/ban-ts-comment */
      },
    }
  )

  await supabase.auth.getSession()
  return response
}
