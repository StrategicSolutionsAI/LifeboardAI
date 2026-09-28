'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PENDING_INVITE_COOKIE, PENDING_INVITE_MAX_AGE_S } from '@/lib/household/pending-invite'

function clearPendingInvite() {
  document.cookie = `${PENDING_INVITE_COOKIE}=; path=/; max-age=0; samesite=lax`
}

export function JoinActions({ token, signedIn, nextPath }: { token: string; signedIn: boolean; nextPath: string }) {
  const router = useRouter()
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Remember the invite so signing up or in by any route (email confirmation,
  // Google) lands back here to confirm.
  useEffect(() => {
    if (!signedIn) {
      document.cookie = `${PENDING_INVITE_COOKIE}=${token}; path=/; max-age=${PENDING_INVITE_MAX_AGE_S}; samesite=lax`
    }
  }, [signedIn, token])

  if (!signedIn) {
    return (
      <div className="space-y-3">
        <Link href="/signup" className="block">
          <Button className="w-full text-white bg-theme-primary hover:bg-theme-primary-600">Create an account to join</Button>
        </Link>
        <Link href={`/login?redirect=${encodeURIComponent(`/join/${token}`)}`} className="block">
          <Button variant="outline" className="w-full border-theme-neutral-300 bg-white text-theme-text-primary hover:bg-theme-surface-alt">
            I already have an account
          </Button>
        </Link>
      </div>
    )
  }

  const join = async () => {
    setJoining(true)
    setError(null)
    try {
      const res = await fetch('/api/household/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not join this household')
      clearPendingInvite()
      router.push(nextPath)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join this household')
      setJoining(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={join} disabled={joining} className="w-full text-white bg-theme-primary hover:bg-theme-primary-600 gap-2">
        {joining && <Loader2 className="h-4 w-4 animate-spin" />}
        Join household
      </Button>
      <button
        onClick={() => { clearPendingInvite(); router.push('/dashboard') }}
        disabled={joining}
        className="block w-full text-center text-sm text-theme-text-tertiary hover:text-theme-text-primary"
      >
        Not now
      </button>
      {error && <p role="alert" className="text-center text-sm text-red-600">{error}</p>}
    </div>
  )
}
