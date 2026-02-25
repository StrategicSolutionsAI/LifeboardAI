export const dynamic = 'force-dynamic'

import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  
  
  // Handle OAuth errors from Google
  if (error) {
    console.error('AuthCallback → OAuth error from provider:', error)
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url))
  }

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
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('AuthCallback → exchangeCodeForSession error', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url))
    }
  }

  // Ensure the session cookie is present and then look up the user
  // Add a small delay to allow cookies to be fully set in production
  if (process.env.NODE_ENV === 'production') {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  const { data: { session } } = await supabase.auth.getSession()
  const { data: { user } } = await supabase.auth.getUser()


  if (!user) {
    console.error('AuthCallback → No user found after code exchange')
    return NextResponse.redirect(new URL('/login?error=Authentication failed', request.url))
  }

  // Route only truly new users to onboarding.
  // Existing users should always land on dashboard, even if they came from signup.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  let destination = '/dashboard'

  if (!profile) {
    await supabase.from('profiles').insert({ id: user.id, onboarded: false }).throwOnError()
    destination = '/onboarding/0'
  }

  // Create the final redirect, copying cookies set earlier into the redirect response
  const redirectResponse = NextResponse.redirect(new URL(destination!, request.url))

  // Copy Supabase cookies exactly as they were provided so the browser session persists
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set({
      name: cookie.name,
      value: cookie.value,
      secure: typeof cookie.secure === 'boolean' ? cookie.secure : process.env.NODE_ENV === 'production',
      sameSite: cookie.sameSite ?? 'lax',
      httpOnly: cookie.httpOnly ?? cookie.name.includes('auth-token'),
      path: cookie.path || '/',
      maxAge: cookie.maxAge,
      expires: cookie.expires,
    })
  }

  return redirectResponse
}
