import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'

interface BucketStats {
  tasks: number
  widgets: number
  shopping: number
  calendar: number
}

export const GET = withAuth(async (_req, { supabase, user }) => {
  const [tasksRes, shoppingRes, calendarRes, prefsRes] = await Promise.all([
    supabase
      .from('lifeboard_tasks')
      .select('bucket')
      .eq('user_id', user.id)
      .eq('completed', false)
      .not('bucket', 'is', null),
    supabase
      .from('shopping_list_items')
      .select('bucket')
      .eq('user_id', user.id)
      .eq('is_purchased', false)
      .not('bucket', 'is', null),
    supabase
      .from('calendar_events')
      .select('bucket')
      .eq('user_id', user.id)
      .not('bucket', 'is', null),
    supabase
      .from('user_preferences')
      .select('widgets_by_bucket')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const stats: Record<string, BucketStats> = {}

  const ensure = (bucket: string) => {
    if (!stats[bucket]) stats[bucket] = { tasks: 0, widgets: 0, shopping: 0, calendar: 0 }
  }

  if (!tasksRes.error && tasksRes.data) {
    for (const row of tasksRes.data) {
      if (row.bucket) { ensure(row.bucket); stats[row.bucket].tasks++ }
    }
  }

  if (!shoppingRes.error && shoppingRes.data) {
    for (const row of shoppingRes.data) {
      if (row.bucket) { ensure(row.bucket); stats[row.bucket].shopping++ }
    }
  }

  if (!calendarRes.error && calendarRes.data) {
    for (const row of calendarRes.data) {
      if (row.bucket) { ensure(row.bucket); stats[row.bucket].calendar++ }
    }
  }

  if (!prefsRes.error && prefsRes.data?.widgets_by_bucket) {
    const wbb = prefsRes.data.widgets_by_bucket as Record<string, unknown[]>
    for (const [bucket, widgets] of Object.entries(wbb)) {
      if (Array.isArray(widgets)) {
        ensure(bucket)
        stats[bucket].widgets = widgets.length
      }
    }
  }

  return NextResponse.json({ stats })
}, 'GET /api/folder-stats')
