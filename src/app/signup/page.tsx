"use client"

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { emailSignUp, emailLogin, signInWithGoogle, signUpWithGoogle } from '@/app/login/actions'
import SectionLoadTimer from '@/components/section-load-timer'
import { surface, form } from '@/lib/styles'

const inputClass = `${form.authInput} font-['Manrope',sans-serif]`

function SignUpContent() {
  const [isLogin, setIsLogin] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={surface.pageBgStyle}>
      <Card className="w-full max-w-md p-8 border-theme-neutral-300 shadow-warm-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-theme-text-primary">
            {isLogin ? "Welcome Back" : "Create Your Account"}
          </h1>
          <p className="text-theme-text-tertiary mt-2">
            {isLogin ? "Sign in to your Lifeboard.ai account" : "Join Lifeboard.ai today"}
          </p>
        </div>

        {/* Google */}
        <form action={isLogin ? signInWithGoogle : signUpWithGoogle} className="space-y-4 mb-4">
          <Button type="submit" className="w-full text-white bg-theme-primary hover:bg-theme-primary-600" disabled={submitting}>
            Continue with Google
          </Button>
        </form>

        <div className="relative flex items-center justify-center mb-4">
          <span className="h-px w-full bg-theme-neutral-300" />
          <span className="absolute px-2 bg-white text-sm text-theme-text-tertiary">or</span>
        </div>
        <form action={isLogin ? emailLogin : emailSignUp} className="space-y-6" onSubmit={()=>setSubmitting(true)}>
          {!isLogin && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-theme-text-primary mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-theme-text-primary mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-theme-text-primary mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className={inputClass}
              required
            />
          </div>

          <Button type="submit" className="w-full text-white bg-theme-primary hover:bg-theme-primary-600" disabled={submitting}>
            {isLogin ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-medium text-theme-primary hover:text-theme-primary-600"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"
            }
          </button>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-theme-text-tertiary hover:text-theme-text-primary text-sm">
            ← Return to Homepage
          </Link>
          {error && (
            <p className="text-red-500 text-sm text-center mt-4">{decodeURIComponent(error)}</p>
          )}
        </div>
      </Card>
    </div>
  )
}

export default function SignUp() {
  return (
    <>
      <SectionLoadTimer name="/signup" />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <SignUpContent />
      </Suspense>
    </>
  )
}
