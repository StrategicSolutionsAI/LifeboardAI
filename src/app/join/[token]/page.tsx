import Link from 'next/link'
import { CalendarDays, ListChecks, ShoppingCart, Wallet } from 'lucide-react'
import { supabaseServer } from '@/utils/supabase/server'
import { getUserCached } from '@/lib/server-auth-cache'
import { surface } from '@/lib/styles'
import { JoinActions } from './join-actions'

export const metadata = { title: 'Join a household' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SHARED = [
  { icon: CalendarDays, label: 'Calendar' },
  { icon: ListChecks, label: 'Tasks and chores' },
  { icon: ShoppingCart, label: 'Shopping list' },
  { icon: Wallet, label: 'Budget' },
]

export default async function JoinHouseholdPage({ params }: { params: { token: string } }) {
  const supabase = supabaseServer()
  const token = params.token
  const [{ data: { user } }, preview] = await Promise.all([
    getUserCached(supabase),
    UUID.test(token)
      ? supabase.rpc('household_invite_preview', { p_token: token }).then((r) => r.data?.[0] ?? null)
      : Promise.resolve(null),
  ])

  let nextPath = '/dashboard'
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('onboarded').eq('id', user.id).maybeSingle()
    if (!profile?.onboarded) nextPath = '/onboarding/0'
  }

  const usedByOther = preview?.status === 'active'

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={surface.pageBgStyle}>
      <div className="w-full max-w-md bg-white shadow-warm-lg rounded-2xl p-8 space-y-6 border border-theme-neutral-300">
        {!preview || usedByOther ? (
          <>
            <h1 className="text-2xl font-bold text-center text-theme-text-primary">
              {usedByOther ? 'This invite was already used' : 'This invite link isn’t valid'}
            </h1>
            <p className="text-center text-sm text-theme-text-tertiary">
              Ask the person who invited you to send a new link.
            </p>
            <Link href={user ? '/dashboard' : '/'} className="block text-center text-sm font-medium text-theme-primary hover:underline">
              {user ? 'Go to your dashboard' : 'Go to Lifeboard'}
            </Link>
          </>
        ) : (
          <>
            <div className="space-y-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-primary">You’re invited</p>
              <h1 className="text-2xl font-bold text-theme-text-primary text-balance">
                Join {preview.household_name}
              </h1>
              <p className="text-sm text-theme-text-tertiary">
                {preview.inviter_name} invited you to plan together on Lifeboard.
              </p>
            </div>

            <div className="rounded-xl bg-theme-surface-alt p-4">
              <p className="mb-3 text-xs font-medium text-theme-text-secondary">You’ll share</p>
              <ul className="grid grid-cols-2 gap-2">
                {SHARED.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2 text-sm text-theme-text-body">
                    <Icon className="h-4 w-4 text-theme-primary shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-theme-text-tertiary">
                Your health data, email and notes stay private.
              </p>
            </div>

            <JoinActions token={token} signedIn={!!user} nextPath={nextPath} />
          </>
        )}
      </div>
    </div>
  )
}
