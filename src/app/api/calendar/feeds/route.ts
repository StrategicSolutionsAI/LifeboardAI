import { NextResponse } from 'next/server'
import { withAuthAndBody } from '@/lib/api-utils'
import { createApiError } from '@/lib/api-error-handler'
import { apiLimiter, getRateLimitKey } from '@/lib/rate-limit'
import { subscribeCalendarFeedSchema } from '@/lib/validations'
import { FeedError, fetchFeedText, normalizeFeedUrl } from '@/lib/calendar/feed'
import { icsCalendarName } from '@/lib/calendar/ics'
import { CalendarImportWriteError } from '@/lib/calendar/ics-import'
import { syncCalendarFeed } from '@/lib/calendar/feed-sync'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST — subscribe to a calendar by URL (school, team, a shared Google/Apple calendar)
export const POST = withAuthAndBody(subscribeCalendarFeedSchema, async (req, { supabase, user, body }) => {
  const limited = apiLimiter.check(getRateLimitKey(req, user.id))
  if (limited) return limited

  let feedUrl: string
  let text: string
  try {
    feedUrl = normalizeFeedUrl(body.url)
    // Validate the feed before creating anything, so a bad link leaves no trace.
    text = await fetchFeedText(feedUrl)
  } catch (error) {
    if (error instanceof FeedError) throw createApiError(error.message, error.status, 'FEED_UNAVAILABLE')
    throw error
  }

  const { data: existing } = await supabase
    .from('calendar_imports')
    .select('id')
    .eq('user_id', user.id)
    .eq('feed_url', feedUrl)
    .maybeSingle()
  if (existing) throw createApiError('You already subscribe to this calendar', 409, 'DUPLICATE_FEED')

  const name = body.name?.trim() || icsCalendarName(text) || new URL(feedUrl).hostname
  const bucket = body.bucket?.trim() || null
  const { data: feed, error: insertError } = await supabase
    .from('calendar_imports')
    .insert({ user_id: user.id, name, file_name: new URL(feedUrl).hostname, default_bucket: bucket, feed_url: feedUrl })
    .select('id, feed_url, default_bucket')
    .single()
  if (insertError) throw createApiError('Failed to save the calendar subscription', 500, 'DB_ERROR', insertError)

  try {
    const result = await syncCalendarFeed(supabase, user.id, feed, text)
    return NextResponse.json({
      success: true,
      message: `Subscribed to ${name}`,
      totalEvents: result.totalEvents,
      importedEvents: result.insertedCount,
      tasksCreated: result.tasksCreated,
      tasksUpdated: result.tasksUpdated,
      taskSyncErrors: result.tasksErrored,
      importId: feed.id,
      calendarName: name,
      bucket,
    }, { status: 201 })
  } catch (error) {
    await supabase.rpc('delete_calendar_import', { p_import_id: feed.id })
    if (error instanceof CalendarImportWriteError) return NextResponse.json(error.body, { status: 500 })
    throw error
  }
}, 'POST /api/calendar/feeds')
