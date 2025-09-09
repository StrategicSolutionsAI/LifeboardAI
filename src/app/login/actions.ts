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

// Email password login
export async function emailLogin(formData: FormData): Promise<void> {
  const supabase = supabaseServer()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }
  redirect('/dashboard')
}

// Google Fit auth
export async function signInWithGoogleFit() {
  try {
    const { getGoogleFitAuthUrl } = await import('@/lib/googlefit/client')
    const url = getGoogleFitAuthUrl()
    return { url }
  } catch (err: any) {
    return { error: err?.message ?? 'Failed to initiate Google Fit authentication' }
  }
}

// Simple email sign-up

export async function emailSignUp(formData: FormData): Promise<void> {
  const supabase = supabaseServer()
  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  }
  redirect('/onboarding/0')
}
