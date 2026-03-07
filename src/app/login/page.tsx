import { signInWithGoogle, emailLogin } from './actions'
import { Button } from '@/components/ui/button'
import SectionLoadTimer from '@/components/section-load-timer'
import Link from 'next/link'
import { surface, form } from '@/lib/styles'

export const dynamic = 'force-dynamic' // avoid static build for auth

export default function Login() {
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
          <Button type="submit" className="w-full text-white bg-theme-primary hover:bg-theme-primary-600">
            Continue
          </Button>
        </form>

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
