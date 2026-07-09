"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { surface, form } from '@/lib/styles'

// Reached from the password-reset email: /auth/callback exchanges the code
// for a session, then redirects here so the user can set a new password.
export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setIsSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setIsSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={surface.pageBgStyle}>
      <div className="w-full max-w-md bg-white shadow-warm-lg rounded-2xl p-8 space-y-6 border border-theme-neutral-300">
        <h1 className="text-2xl font-bold text-center text-theme-text-primary">Choose a new password</h1>
        <p className="text-center text-sm text-theme-text-tertiary -mt-3">
          Set a new password for your account. You&apos;ll stay signed in afterwards.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${form.authInput} font-['Manrope',sans-serif]`}
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`${form.authInput} font-['Manrope',sans-serif]`}
          />
          <Button
            type="submit"
            disabled={isSaving}
            className="w-full text-white bg-theme-primary hover:bg-theme-primary-600"
          >
            {isSaving ? 'Saving…' : 'Save new password'}
          </Button>
        </form>

        {error && <p className="text-theme-error text-sm text-center">{error}</p>}

        <div className="text-center text-sm">
          <p className="text-theme-text-secondary">
            Link expired?{' '}
            <Link href="/forgot-password" className="font-medium text-theme-primary hover:text-theme-primary-600">
              Request a new one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
