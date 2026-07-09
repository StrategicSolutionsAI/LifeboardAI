'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
 
function getBaseUrl() {
  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
import { supabaseServer } from '@/utils/supabase/server'

export async function signInWithGoogle() {
  const supabase = supabaseServer()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${getBaseUrl()}/auth/callback?from=login`,
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) throw error
  redirect(data.url)
}

// Google from signup triggers onboarding
export async function signUpWithGoogle() {
  const supabase = supabaseServer()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${getBaseUrl()}/auth/callback?from=signup`,
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) throw error
  redirect(data.url)
}

// Only allow same-origin path redirects — anything else could be used to
// bounce a freshly logged-in user to an attacker-chosen site.
function sanitizeRedirect(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return null
  }
  return value
}

// Email password login
export async function emailLogin(formData: FormData): Promise<void> {
  const redirectTo = sanitizeRedirect(formData.get('redirect'))
  // Keep the deep link through error round-trips back to /login.
  // (Explicit `never` annotation on the const lets TS narrow after calls.)
  const loginError: (message: string) => never = (message) => {
    const params = new URLSearchParams({ error: message })
    if (redirectTo) params.set('redirect', redirectTo)
    redirect(`/login?${params.toString()}`)
  }

  const supabase = supabaseServer()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) {
    loginError(error.message)
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    loginError('Unable to load account profile')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    loginError(profileError.message)
  }

  if (!profile) {
    const { error: createProfileError } = await supabase
      .from('profiles')
      .insert({ id: user.id, onboarded: false })

    if (createProfileError) {
      loginError(createProfileError.message)
    }

    redirect('/onboarding/0')
  }

  redirect(redirectTo ?? '/dashboard')
}

// Simple email sign-up

export async function emailSignUp(formData: FormData): Promise<void> {
  const supabase = supabaseServer()
  const { data, error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  }
  if (!data.session) {
    // Email confirmation is enabled — there is no session yet, so /onboarding
    // would just bounce back to /login. Tell the user what to do instead.
    redirect(`/login?message=${encodeURIComponent('Check your email to confirm your account, then sign in.')}`)
  }
  redirect('/onboarding/0')
}
