export const dynamic = 'force-dynamic'

import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const from = requestUrl.searchParams.get('from') // login | signup

  // Prepare a placeholder response; we will set the final redirect after we know where to go
  let response = NextResponse.next({ request: { headers: request.headers } })

  // Create a Supabase client that can read/write cookies on this response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          // write to both request and response so subsequent reads in this handler see the cookie
          // eslint-disable-next-line
          ;(request.cookies as any).set(name, value, options)
          // eslint-disable-next-line
          ;(response.cookies as any).set(name, value, options)
        },
        remove(name: string, options: any) {
          // eslint-disable-next-line
          ;(request.cookies as any).set(name, '', options)
          // eslint-disable-next-line
          ;(response.cookies as any).set(name, '', options)
        },
      },
    },
  )

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('AuthCallback → exchangeCodeForSession error', error)
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Ensure the session cookie is present and then look up the user
  await supabase.auth.getSession()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Decide destination based on onboarding state
  let destination: string | null = null

  if (from === 'signup') {
    await supabase.from('profiles').upsert({ id: user.id, onboarded: false }).throwOnError()
    destination = '/onboarding/0'
  } else {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarded')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      await supabase.from('profiles').insert({ id: user.id }).throwOnError()
      destination = '/onboarding/0'
    } else if (!profile.onboarded) {
      destination = '/onboarding/0'
    } else {
      destination = '/dashboard'
    }
  }

  // Create the final redirect, copying cookies set earlier into the redirect response
  const redirectResponse = NextResponse.redirect(new URL(destination!, request.url))
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie)
  }
  return redirectResponse
}
