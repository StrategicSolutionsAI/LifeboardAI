export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { supabaseServer } from '@/utils/supabase/server'

interface SearchParamProps {
  searchParams: { [key: string]: string | undefined }
}

// This page is hit by Supabase after OAuth sign-in / sign-up.
// We consume the auth code, set cookies via supabaseServer(),
// then decide where to send the user:
//  – New signup  → onboarding flow
//  – Existing user → dashboard
export default async function AuthCallback({ searchParams }: SearchParamProps) {
  // Create server client – this will exchange the auth code & set cookies
  const supabase = supabaseServer()
  await supabase.auth.getSession()

  console.log('AuthCallback → searchParams', searchParams)

  // Fetch the authenticated user details
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // If this flow originated from the signup page, always send the user to onboarding 1
  if (searchParams.from === 'signup') {
    await supabase
      .from('profiles')
      .upsert({ id: user.id, onboarded: false })
      .throwOnError()
    redirect('/onboarding/1')
  }

  // Determine next route based on existing onboarding status
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('onboarded')
    .eq('id', user.id)
    .maybeSingle()

  console.log('AuthCallback → user', user)
  console.log('AuthCallback → profile', profile)
  console.log('AuthCallback → profileError', profileError)

  if (!profile) {
    // first time user – create profile with onboarded = false then send to onboarding
    await supabase.from('profiles').insert({ id: user.id }).throwOnError()
    redirect('/onboarding/1')
  }

  if (!profile.onboarded) {
    redirect('/onboarding/1')
  }

  redirect('/dashboard')
}
