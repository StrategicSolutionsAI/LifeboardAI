'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { supabaseServer } from '@/utils/supabase/server'

function getBaseUrl() {
  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function requestPasswordReset(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim()
  if (!email) {
    redirect(`/forgot-password?error=${encodeURIComponent('Enter your email address.')}`)
  }

  const supabase = supabaseServer()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // The emailed link lands on /auth/callback, which exchanges the code for
    // a session and then honors `next` to open the change-password form.
    redirectTo: `${getBaseUrl()}/auth/callback?next=/reset-password`,
  })

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`)
  }

  // Same message whether or not an account exists — don't reveal which
  // emails have accounts.
  redirect(
    `/forgot-password?message=${encodeURIComponent(
      'If an account exists for that email, a reset link is on its way. Check your inbox.'
    )}`
  )
}
