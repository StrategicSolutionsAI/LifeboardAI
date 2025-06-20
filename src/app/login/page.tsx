import { signInWithGoogle, emailLogin } from './actions'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic' // avoid static build for auth

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-8 space-y-6">
        <h1 className="text-2xl font-bold text-center">Sign in to Lifeboard</h1>

        {/* Google */}
        <form action={signInWithGoogle} className="space-y-4">
          <Button type="submit" className="w-full bg-red-500 hover:bg-red-600">
            Continue with Google
          </Button>
        </form>

        <div className="relative flex items-center justify-center">
          <span className="h-px w-full bg-gray-200" />
          <span className="absolute px-2 bg-white text-sm text-gray-500">or</span>
        </div>

        {/* Email */}
        <form action={emailLogin} className="space-y-4">
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </div>
    </div>
  )
}
