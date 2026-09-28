import { NextResponse } from 'next/server'
import { withAuthAndBody } from '@/lib/api-utils'
import { createApiError } from '@/lib/api-error-handler'
import { apiLimiter, getRateLimitKey } from '@/lib/rate-limit'
import { refreshCalendarFeedSchema } from '@/lib/validations'
import { FeedError } from '@/lib/calendar/feed'
import { CalendarImportWriteError } from '@/lib/calendar/ics-import'
import { syncCalendarFeed } from '@/lib/calendar/feed-sync'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST — re-fetch a subscribed calendar now (its author only)
export const POST = withAuthAndBody(refreshCalendarFeedSchema, async (req, { supabase, user, body }) => {
  const limited = apiLimiter.check(getRateLimitKey(req, user.id))
  if (limited) return limited

  const { data: feed } = await supabase
    .from('calendar_imports')
    .select('id, feed_url, default_bucket')
    .eq('id', body.importId)
    .eq('user_id', user.id)
    .not('feed_url', 'is', null)
    .maybeSingle()
  if (!feed) throw createApiError('Subscribed calendar not found', 404, 'NOT_FOUND')

  try {
    const result = await syncCalendarFeed(supabase, user.id, feed)
    return NextResponse.json({ ok: true, events: result.totalEvents, removed: result.removedEvents })
  } catch (error) {
    if (error instanceof FeedError) throw createApiError(error.message, error.status, 'FEED_UNAVAILABLE')
    if (error instanceof CalendarImportWriteError) return NextResponse.json(error.body, { status: 500 })
    throw error
  }
}, 'POST /api/calendar/feeds/refresh')
