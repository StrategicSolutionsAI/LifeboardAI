"use client"

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { emailSignUp, emailLogin, signUpWithGoogle } from '@/app/login/actions'

function SignUpContent() {
  const [isLogin, setIsLogin] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {isLogin ? "Welcome Back" : "Create Your Account"}
          </h1>
          <p className="text-gray-600 mt-2">
            {isLogin ? "Sign in to your Lifeboard.ai account" : "Join Lifeboard.ai today"}
          </p>
        </div>

        {/* Google */}
        <form action={signUpWithGoogle} className="space-y-4 mb-4">
          <Button type="submit" className="w-full text-white bg-[#8491FF] hover:bg-[#7482FE]" disabled={submitting}>
            Continue with Google
          </Button>
        </form>

        <div className="relative flex items-center justify-center mb-4">
          <span className="h-px w-full bg-gray-200" />
          <span className="absolute px-2 bg-white text-sm text-gray-500">or</span>
        </div>
        <form action={isLogin ? emailLogin : emailSignUp} className="space-y-6" onSubmit={()=>setSubmitting(true)}>
          {!isLogin && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8491FF]"
              />
            </div>
          )}
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8491FF]"
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8491FF]"
              required
            />
          </div>
          
          <Button type="submit" className="w-full text-white bg-[#8491FF] hover:bg-[#7482FE]" disabled={submitting}>
            {isLogin ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-medium text-[#8491FF] hover:text-[#7482FE]"
          >
            {isLogin 
              ? "Don't have an account? Sign up" 
              : "Already have an account? Sign in"
            }
          </button>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SignUpContent />
    </Suspense>
  )
}
