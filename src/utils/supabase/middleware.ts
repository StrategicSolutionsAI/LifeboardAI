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
        set(name: string, value: string, opts: any) {
          request.cookies.set(name, value, opts)
          response.cookies.set(name, value, opts)
        },
        remove(name: string, opts: any) {
          request.cookies.set(name, '', opts)
          response.cookies.set(name, '', opts)
        },
      },
    }
  )

  await supabase.auth.getSession()
  return response
}
