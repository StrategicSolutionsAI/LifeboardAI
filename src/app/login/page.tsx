import { signInWithGoogle, emailLogin } from './actions'
import { Button } from '@/components/ui/button'
import SectionLoadTimer from '@/components/section-load-timer'
import Link from 'next/link'
import { surface, form } from '@/lib/styles'

export const dynamic = 'force-dynamic' // avoid static build for auth

// Next has already URL-decoded searchParams — decoding again would corrupt
// messages containing literal %-sequences.
function friendlyLoginError(message: string): string {
  if (message === 'Invalid login credentials') {
    return 'Incorrect email or password.'
  }
  return message
}

export default function Login({ searchParams }: { searchParams: { error?: string; message?: string; redirect?: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={surface.pageBgStyle}>
      <SectionLoadTimer name="/login" />
      <div className="w-full max-w-md bg-white shadow-warm-lg rounded-2xl p-8 space-y-6 border border-theme-neutral-300">
        <h1 className="text-2xl font-bold text-center text-theme-text-primary">Sign in to Lifeboard</h1>
        <p className="text-center text-sm text-theme-text-tertiary -mt-3">
          Jump back into your dashboard and continue where you left off.
        </p>

        {/* Google */}
        <form action={signInWithGoogle} className="space-y-4">
          <Button type="submit" className="w-full text-white bg-theme-primary hover:bg-theme-primary-600">
            Continue with Google
          </Button>
        </form>

        <div className="relative flex items-center justify-center">
          <span className="h-px w-full bg-theme-neutral-300" />
          <span className="absolute px-2 bg-white text-sm text-theme-text-tertiary">or</span>
        </div>

        {/* Email */}
        <form action={emailLogin} className="space-y-4">
          {searchParams.redirect && (
            <input type="hidden" name="redirect" value={searchParams.redirect} />
          )}
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className={`${form.authInput} font-['Manrope',sans-serif]`}
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className={`${form.authInput} font-['Manrope',sans-serif]`}
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-theme-text-tertiary hover:text-theme-primary"
            >
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full text-white bg-theme-primary hover:bg-theme-primary-600">
            Continue
          </Button>
        </form>

        {searchParams.error && (
          <p className="text-theme-error text-sm text-center">
            {friendlyLoginError(searchParams.error)}
          </p>
        )}

        {searchParams.message && !searchParams.error && (
          <p className="text-theme-text-secondary text-sm text-center">
            {searchParams.message}
          </p>
        )}

        <div className="text-center space-y-2 text-sm">
          <p className="text-theme-text-secondary">
            New to Lifeboard?{" "}
            <Link href="/signup" className="font-medium text-theme-primary hover:text-theme-primary-600">
              Create an account
            </Link>
          </p>
          <Link href="/" className="inline-block text-theme-text-tertiary hover:text-theme-text-primary">
            Return to homepage
          </Link>
        </div>
      </div>
    </div>
  )
}
