import { signInWithGoogle, emailLogin } from './actions'
import { Button } from '@/components/ui/button'
import SectionLoadTimer from '@/components/section-load-timer'
import Link from 'next/link'

export const dynamic = 'force-dynamic' // avoid static build for auth

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundImage: "linear-gradient(90deg, rgba(252,250,248,0.7) 0%, rgba(252,250,248,0.7) 100%), linear-gradient(90deg, #fff 0%, #fff 100%)" }}>
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
            className="w-full border border-[#dee4ee] rounded-[11px] px-3 py-2 text-sm font-['Manrope',sans-serif] text-theme-text-primary placeholder:text-[#8796af] bg-[rgba(255,255,255,0.92)] focus:outline-none focus:ring-2 focus:ring-theme-primary/50 focus:border-theme-primary"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="w-full border border-[#dee4ee] rounded-[11px] px-3 py-2 text-sm font-['Manrope',sans-serif] text-theme-text-primary placeholder:text-[#8796af] bg-[rgba(255,255,255,0.92)] focus:outline-none focus:ring-2 focus:ring-theme-primary/50 focus:border-theme-primary"
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
