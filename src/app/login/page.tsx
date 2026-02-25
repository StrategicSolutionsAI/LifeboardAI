import { signInWithGoogle, emailLogin } from './actions'
import { Button } from '@/components/ui/button'
import SectionLoadTimer from '@/components/section-load-timer'
import Link from 'next/link'

export const dynamic = 'force-dynamic' // avoid static build for auth

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundImage: "linear-gradient(90deg, rgba(252,250,248,0.7) 0%, rgba(252,250,248,0.7) 100%), linear-gradient(90deg, #fff 0%, #fff 100%)" }}>
      <SectionLoadTimer name="/login" />
      <div className="w-full max-w-md bg-white shadow-warm-lg rounded-2xl p-8 space-y-6 border border-[#dbd6cf]">
        <h1 className="text-2xl font-bold text-center text-[#314158]">Sign in to Lifeboard</h1>
        <p className="text-center text-sm text-[#8e99a8] -mt-3">
          Jump back into your dashboard and continue where you left off.
        </p>

        {/* Google */}
        <form action={signInWithGoogle} className="space-y-4">
          <Button type="submit" className="w-full text-white bg-[#B1916A] hover:bg-[#9a7b5a]">
            Continue with Google
          </Button>
        </form>

        <div className="relative flex items-center justify-center">
          <span className="h-px w-full bg-[#dbd6cf]" />
          <span className="absolute px-2 bg-white text-sm text-[#8e99a8]">or</span>
        </div>

        {/* Email */}
        <form action={emailLogin} className="space-y-4">
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full border border-[#dee4ee] rounded-[11px] px-3 py-2 text-[14px] font-['Manrope',sans-serif] text-[#314158] placeholder:text-[#8796af] bg-[rgba(255,255,255,0.92)] focus:outline-none focus:ring-2 focus:ring-[#B1916A]/50 focus:border-[#B1916A]"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="w-full border border-[#dee4ee] rounded-[11px] px-3 py-2 text-[14px] font-['Manrope',sans-serif] text-[#314158] placeholder:text-[#8796af] bg-[rgba(255,255,255,0.92)] focus:outline-none focus:ring-2 focus:ring-[#B1916A]/50 focus:border-[#B1916A]"
          />
          <Button type="submit" className="w-full text-white bg-[#B1916A] hover:bg-[#9a7b5a]">
            Continue
          </Button>
        </form>

        <div className="text-center space-y-2 text-sm">
          <p className="text-[#596881]">
            New to Lifeboard?{" "}
            <Link href="/signup" className="font-medium text-[#B1916A] hover:text-[#9a7b5a]">
              Create an account
            </Link>
          </p>
          <Link href="/" className="inline-block text-[#8e99a8] hover:text-[#314158]">
            Return to homepage
          </Link>
        </div>
      </div>
    </div>
  )
}
