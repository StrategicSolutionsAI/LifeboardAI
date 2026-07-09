import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { surface, form } from '@/lib/styles'
import { requestPasswordReset } from './actions'

export const dynamic = 'force-dynamic' // avoid static build for auth

export default function ForgotPassword({ searchParams }: { searchParams: { error?: string; message?: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={surface.pageBgStyle}>
      <div className="w-full max-w-md bg-white shadow-warm-lg rounded-2xl p-8 space-y-6 border border-theme-neutral-300">
        <h1 className="text-2xl font-bold text-center text-theme-text-primary">Reset your password</h1>
        <p className="text-center text-sm text-theme-text-tertiary -mt-3">
          Enter the email you signed up with and we&apos;ll send you a link to set a new password.
        </p>

        <form action={requestPasswordReset} className="space-y-4">
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className={`${form.authInput} font-['Manrope',sans-serif]`}
          />
          <Button type="submit" className="w-full text-white bg-theme-primary hover:bg-theme-primary-600">
            Send reset link
          </Button>
        </form>

        {searchParams.error && (
          <p className="text-theme-error text-sm text-center">{searchParams.error}</p>
        )}

        {searchParams.message && !searchParams.error && (
          <p className="text-theme-text-secondary text-sm text-center">{searchParams.message}</p>
        )}

        <div className="text-center space-y-2 text-sm">
          <p className="text-theme-text-secondary">
            Remembered it?{' '}
            <Link href="/login" className="font-medium text-theme-primary hover:text-theme-primary-600">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
