import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { createApiError } from '@/lib/api-error-handler'
import { chatLimiter, getRateLimitKey } from '@/lib/rate-limit'
import { pushConfigError, sendPush } from '@/lib/reminders/web-push'

// POST — send a test notification to each of the caller's devices
export const POST = withAuth(async (req, { supabase, user }) => {
  const limited = chatLimiter.check(getRateLimitKey(req, user.id))
  if (limited) return limited
  const configError = pushConfigError()
  if (configError) throw createApiError(configError, 503, 'PUSH_NOT_CONFIGURED')

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user.id)
  if (error) throw createApiError('Failed to load subscriptions', 500, 'DB_ERROR', error)
  if (!subs?.length) throw createApiError('Reminders are not turned on for any device', 404, 'NO_SUBSCRIPTION')

  let sent = 0
  for (const sub of subs) {
    const outcome = await sendPush(sub, {
      title: 'Reminders are on',
      body: 'You’ll get a notification before tasks that have a time.',
      url: '/dashboard',
      tag: 'lifeboard-test',
    })
    if (outcome === 'sent') sent += 1
    if (outcome === 'gone') await supabase.from('push_subscriptions').delete().eq('id', sub.id)
  }
  return NextResponse.json({ sent })
}, 'POST /api/push/test')
