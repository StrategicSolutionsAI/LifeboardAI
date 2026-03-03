// app/api/day/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'

// lifeboard_tasks → unified item
function mapTaskRow(row: Record<string, unknown>) {
  const startDate = (row.start_date ?? row.due_date ?? undefined) as string | undefined
  const endDate = (row.end_date ?? startDate ?? undefined) as string | undefined
  return {
    id: `task:${row.id}`,
    kind: 'task' as const,
    content: row.content as string,
    completed: !!row.completed,
    startDate,
    endDate,
    hourSlot: row.hour_slot ?? undefined,
    allDay: row.all_day ?? (!row.hour_slot && !row.end_hour_slot),
    created_at: row.created_at as string,
    position: (row.position ?? undefined) as number | undefined,
  }
}

// calendar_events → unified item
function mapEventRow(row: Record<string, unknown>) {
  const title =
    (row.title ?? row.summary ?? row.name ?? row.content ?? 'Event') as string
  const startDate = (row.start_date ?? row.date ?? row.due_date ?? undefined) as string | undefined
  const endDate = (row.end_date ?? startDate ?? undefined) as string | undefined
  return {
    id: `event:${row.id}`,
    kind: 'event' as const,
    content: title,
    completed: false,
    startDate,
    endDate,
    hourSlot: row.hour_slot ?? undefined,
    allDay: row.all_day ?? (!row.hour_slot),
    created_at: row.created_at as string,
    position: (row.position ?? undefined) as number | undefined,
  }
}

export const GET = withAuth(async (req, { supabase, user }) => {
  const sp = req.nextUrl.searchParams
  const date = sp.get('date') // YYYY-MM-DD (required)
  const includeCompleted = sp.get('includeCompleted') // show completed tasks too

  if (!date) {
    return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 })
  }

  // --- lifeboard_tasks (date matches due_date OR start_date)
  let taskQuery = supabase
    .from('lifeboard_tasks')
    .select('*')
    .eq('user_id', user.id)
    .or(`due_date.eq.${date},start_date.eq.${date}`)

  if (!includeCompleted) {
    taskQuery = taskQuery.eq('completed', false)
  }

  // --- calendar_events (assumes start_date column)
  const eventQuery = supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .eq('start_date', date)

  const [tasksRes, eventsRes] = await Promise.all([taskQuery, eventQuery])

  if (tasksRes.error) {
    console.error('tasks fetch error', tasksRes.error)
    return NextResponse.json({ error: 'Database error (tasks)' }, { status: 500 })
  }
  if (eventsRes.error) {
    console.error('events fetch error', eventsRes.error)
    return NextResponse.json({ error: 'Database error (events)' }, { status: 500 })
  }

  const taskItems = (tasksRes.data ?? []).map(mapTaskRow)
  const eventItems = (eventsRes.data ?? []).map(mapEventRow)

  // Merge + sort: time first, then position, then created_at
  const items = [...taskItems, ...eventItems].sort((a, b) => {
    const ah = typeof a.hourSlot === 'number' ? a.hourSlot : 99
    const bh = typeof b.hourSlot === 'number' ? b.hourSlot : 99
    if (ah !== bh) return ah - bh
    const ap = a.position ?? Number.MAX_SAFE_INTEGER
    const bp = b.position ?? Number.MAX_SAFE_INTEGER
    if (ap !== bp) return ap - bp
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return NextResponse.json({ items })
}, 'GET /api/day')
