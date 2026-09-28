import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncCalendarFeed } from '@/lib/calendar/feed-sync'
import { handleApiError } from '@/lib/api-error-handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const REFRESH_EVERY_MS = 6 * 60 * 60 * 1000
const FEEDS_PER_RUN = 25

// Refreshes subscribed calendars not synced in the last 6 hours. Called by
// .github/workflows/scheduled-jobs.yml with `Authorization: Bearer $CRON_SECRET`.
async function handler(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
    const staleBefore = new Date(Date.now() - REFRESH_EVERY_MS).toISOString()
    const { data: feeds, error } = await admin
      .from('calendar_imports')
      .select('id, user_id, feed_url, default_bucket')
      .not('feed_url', 'is', null)
      .or(`last_synced_at.is.null,last_synced_at.lt.${staleBefore}`)
      .order('last_synced_at', { ascending: true, nullsFirst: true })
      .limit(FEEDS_PER_RUN)
    if (error) throw error

    let refreshed = 0
    let failed = 0
    for (const feed of feeds ?? []) {
      try {
        await syncCalendarFeed(admin, feed.user_id, feed)
        refreshed += 1
      } catch {
        failed += 1 // recorded on the row as last_sync_error
      }
    }
    return NextResponse.json({ refreshed, failed })
  } catch (error) {
    return handleApiError(error, 'cron/calendar-feeds')
  }
}

export const GET = handler
export const POST = handler
