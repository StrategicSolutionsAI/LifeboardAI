export const dynamic = 'force-dynamic'

import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const from = requestUrl.searchParams.get('from') // login | signup
  const error = requestUrl.searchParams.get('error')
  
  console.log('AuthCallback → URL:', requestUrl.toString())
  console.log('AuthCallback → Code:', code ? 'present' : 'missing')
  console.log('AuthCallback → From:', from)
  console.log('AuthCallback → Error param:', error)
  
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
          // Ensure secure cookie settings for production
          const cookieOpts = {
            ...options,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax' as const,
            httpOnly: name.includes('auth-token'), // Only auth cookies should be httpOnly
          }
          // write to both request and response so subsequent reads in this handler see the cookie
          // eslint-disable-next-line
          ;(request.cookies as any).set(name, value, cookieOpts)
          // eslint-disable-next-line
          ;(response.cookies as any).set(name, value, cookieOpts)
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
    console.log('AuthCallback → Exchanging code for session...')
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('AuthCallback → exchangeCodeForSession error', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url))
    }
    console.log('AuthCallback → Session exchanged successfully, user:', sessionData?.user?.email)
  }

  // Ensure the session cookie is present and then look up the user
  // Add a small delay to allow cookies to be fully set in production
  if (process.env.NODE_ENV === 'production') {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  const { data: { session } } = await supabase.auth.getSession()
  const { data: { user } } = await supabase.auth.getUser()

  console.log('AuthCallback → Session found:', !!session)
  console.log('AuthCallback → User found:', !!user, user?.email)

  if (!user) {
    console.error('AuthCallback → No user found after code exchange')
    return NextResponse.redirect(new URL('/login?error=Authentication failed', request.url))
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

  // Ensure all auth cookies are properly copied with production settings
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set({
      ...cookie,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: cookie.name.includes('auth-token'),
    })
  }

  console.log('AuthCallback → Redirecting to:', destination)
  console.log('AuthCallback → Cookies set:', response.cookies.getAll().map(c => c.name))

  return redirectResponse
}
