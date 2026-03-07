import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, withAuthAndBody } from '@/lib/api-utils'

export const GET = withAuth(async (req, { supabase, user }) => {
  const widgetIds = req.nextUrl.searchParams.get('widgetIds')?.split(',').filter(Boolean) ?? []
  if (widgetIds.length === 0) return NextResponse.json({ logs: [] })

  const { data, error } = await supabase
    .from('widget_progress_history')
    .select('widget_instance_id,date,value,created_at')
    .in('widget_instance_id', widgetIds)
    .order('date', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Failed to load widget progress history', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const res = NextResponse.json({ logs: data ?? [] })
  res.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120')
  return res
}, 'GET /api/widgets/progress')

const upsertSchema = z.object({
  rows: z.array(z.object({
    widget_instance_id: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    value: z.number(),
  })).min(1),
})

export const POST = withAuthAndBody(upsertSchema, async (req, { supabase, user, body }) => {
  const rows = body.rows.map(r => ({
    user_id: user.id,
    widget_instance_id: r.widget_instance_id,
    date: r.date,
    value: r.value,
  }))

  const { error } = await supabase
    .from('widget_progress_history')
    .upsert(rows, { onConflict: 'user_id,widget_instance_id,date' })

  if (error) {
    console.error('Failed to upsert widget progress', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}, 'POST /api/widgets/progress')
