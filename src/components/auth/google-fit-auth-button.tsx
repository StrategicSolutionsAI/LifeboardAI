'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface GoogleFitAuthButtonProps {
  className?: string
  authAction: () => Promise<{ url?: string; error?: string }>
}

// Simple inline SVG for Google Fit logo to avoid extra dependencies
function GoogleFitIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mr-2"
    >
      <path
        d="M12.6 12L16 15.4L15.4 16L12 12.6L8.6 16L8 15.4L11.4 12L8 8.6L8.6 8L12 11.4L15.4 8L16 8.6L12.6 12Z"
        fill="#4285F4"
      />
      <path
        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"
        fill="#4285F4"
      />
    </svg>
  )
}

export function GoogleFitAuthButton({ className, authAction }: GoogleFitAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAuth = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await authAction()
      if (result.error) {
        setError(result.error)
      } else if (result.url) {
        window.location.href = result.url
      } else {
        setError('An unexpected error occurred.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      <Button
        onClick={handleAuth}
        disabled={isLoading}
        className={`w-full flex items-center justify-center ${className}`}
      >
        <GoogleFitIcon />
        {isLoading ? 'Connecting...' : 'Connect with Google Fit'}
      </Button>
      {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
    </div>
  )
}
