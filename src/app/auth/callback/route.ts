export const dynamic = 'force-dynamic'

import { NextResponse, NextRequest } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Helper to build relative redirects (declared early so it can be used above)
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.url))

  // Exchange the OAuth code for a session and set cookies
  const supabase = supabaseServer()

  const code = searchParams.get('code')
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      console.error('AuthCallback → exchangeCodeForSession error', exchangeError)
      return redirectTo('/login')
    }
  }

  // After the exchange, ensure the client has a session cookie
  await supabase.auth.getSession()

  // Retrieve the signed-in user (if any)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirectTo('/login')
  }

  // If the flow originated from the signup page, ensure a profile row exists and send to onboarding
  if (searchParams.get('from') === 'signup') {
    await supabase
      .from('profiles')
      .upsert({ id: user.id, onboarded: false })
      .throwOnError()

    return redirectTo('/onboarding/1')
  }

  // Look up the user profile to determine onboarding status
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    // First time user – create profile then send to onboarding
    await supabase.from('profiles').insert({ id: user.id }).throwOnError()
    return redirectTo('/onboarding/1')
  }

  if (!profile.onboarded) {
    return redirectTo('/onboarding/1')
  }

  return redirectTo('/dashboard')
} 