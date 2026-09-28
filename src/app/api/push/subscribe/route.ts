import { NextResponse } from 'next/server'
import { withAuthAndBody } from '@/lib/api-utils'
import { createApiError } from '@/lib/api-error-handler'
import { pushSubscriptionSchema, pushUnsubscribeSchema } from '@/lib/validations'

// POST — turn reminders on for this browser
export const POST = withAuthAndBody(pushSubscriptionSchema, async (_req, { supabase, body }) => {
  const { error } = await supabase.rpc('claim_push_subscription', {
    p_endpoint: body.endpoint,
    p_p256dh: body.keys.p256dh,
    p_auth: body.keys.auth,
    p_time_zone: body.timeZone,
  })
  if (error) throw createApiError('Failed to save reminder subscription', 500, 'DB_ERROR', error)
  return NextResponse.json({ ok: true }, { status: 201 })
}, 'POST /api/push/subscribe')

// DELETE — turn reminders off for this browser
export const DELETE = withAuthAndBody(pushUnsubscribeSchema, async (_req, { supabase, user, body }) => {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', body.endpoint)
  if (error) throw createApiError('Failed to remove reminder subscription', 500, 'DB_ERROR', error)
  return NextResponse.json({ ok: true })
}, 'DELETE /api/push/subscribe')
