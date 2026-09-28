import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchFeedText } from './feed'
import { icsEventsToRows, parseICSFile } from './ics'
import { writeImportEvents, type ImportWriteResult } from './ics-import'

export interface FeedImport {
  id: string
  feed_url: string
  default_bucket: string | null
}

export interface FeedSyncResult extends ImportWriteResult {
  totalEvents: number
  removedEvents: number
}

/**
 * Re-import a subscribed calendar: upsert every event in the feed, then delete
 * events (and their generated tasks) the publisher removed. `prefetched` skips
 * the fetch when the caller already validated the feed text.
 */
export async function syncCalendarFeed(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  feed: FeedImport,
  prefetched?: string,
): Promise<FeedSyncResult> {
  try {
    const text = prefetched ?? (await fetchFeedText(feed.feed_url))
    const events = parseICSFile(text)
    const rows = icsEventsToRows(events, { userId, importId: feed.id, bucket: feed.default_bucket })
    const written = await writeImportEvents(supabase, userId, feed.id, rows)

    let removedEvents = 0
    // A feed that suddenly lists nothing is more likely a publisher glitch than
    // a cleared calendar; keep what we have rather than wiping it.
    if (rows.length > 0) {
      const keep = new Set(rows.map((row) => row.external_id))
      const { data: existing } = await supabase
        .from('calendar_events')
        .select('id, external_id, task_id')
        .eq('user_id', userId)
        .eq('import_id', feed.id)
      const stale = (existing ?? []).filter((row: { external_id: string }) => !keep.has(row.external_id))
      if (stale.length > 0) {
        const taskIds = stale.map((row: { task_id: string | null }) => row.task_id).filter(Boolean)
        if (taskIds.length > 0) {
          await supabase.from('lifeboard_tasks').delete().eq('user_id', userId).in('id', taskIds)
        }
        await supabase.from('calendar_events').delete().eq('user_id', userId).in('id', stale.map((row: { id: string }) => row.id))
        removedEvents = stale.length
      }
    }

    await supabase
      .from('calendar_imports')
      .update({
        event_count: rows.length,
        last_synced_at: new Date().toISOString(),
        last_sync_error: rows.length === 0 ? 'The feed returned no events' : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', feed.id)
      .eq('user_id', userId)

    return { ...written, totalEvents: events.length, removedEvents }
  } catch (error) {
    // Record the failure (and the attempt time, so the scheduler backs off).
    await supabase
      .from('calendar_imports')
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_error: error instanceof Error ? error.message.slice(0, 300) : 'Sync failed',
      })
      .eq('id', feed.id)
      .eq('user_id', userId)
    throw error
  }
}
