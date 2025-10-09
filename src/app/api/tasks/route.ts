import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

// Shape transformer to unify DB row → client Task
function mapRowToTask(row: any) {
  const startDate: string | undefined = row.start_date ?? row.due_date ?? undefined
  const endDate: string | undefined = row.end_date ?? startDate ?? undefined
  return {
    id: row.id,
    content: row.content,
    completed: row.completed,
    due: startDate ? { date: startDate } : undefined,
    startDate,
    endDate,
    hourSlot: row.hour_slot || undefined,
    endHourSlot: row.end_hour_slot || undefined,
    bucket: row.bucket || undefined,
    position: row.position ?? undefined,
    duration: row.duration ?? undefined,
    repeatRule: row.repeat_rule || undefined,
    allDay: row.all_day ?? (row.hour_slot ? false : true),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') // YYYY-MM-DD
    const allParam = searchParams.get('all')

    if (!date && !allParam) {
      return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 })
    }

    const supabase = supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let query = supabase
      .from('lifeboard_tasks')
      .select('id, user_id, content, completed, due_date, start_date, end_date, hour_slot, end_hour_slot, bucket, position, duration, repeat_rule, all_day, created_at, updated_at')
      .eq('user_id', user.id)

    if (date && !allParam) {
      query = query.eq('due_date', date).eq('completed', false)
    }
    if (allParam) {
      query = query.eq('completed', false)
    }

    const { data, error } = await query
    if (error) {
      console.error('Supabase select lifeboard_tasks error', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const tasks = (data || []).map(mapRowToTask)
    // Sort by position if available, otherwise by created_at desc
    tasks.sort((a: any, b: any) => {
      const pa = a.position ?? Number.MAX_SAFE_INTEGER
      const pb = b.position ?? Number.MAX_SAFE_INTEGER
      if (pa !== pb) return pa - pb
      return (new Date(b.created_at).getTime()) - (new Date(a.created_at).getTime())
    })

    return NextResponse.json({ tasks })
  } catch (e) {
    console.error('GET /api/tasks error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as any
    const content = (body.content || '').toString()
    const due_date = body.due_date as string | null | undefined
    const start_date = body.start_date as string | null | undefined
    const end_date_raw = body.end_date as string | null | undefined
    const hour_slot = typeof body.hour_slot === 'number' ? body.hour_slot : undefined
    const hour_slot_str = typeof body.hourSlot === 'string' ? body.hourSlot : undefined
    const end_hour_slot_num = typeof body.end_hour_slot === 'number' ? body.end_hour_slot : undefined
    const end_hour_slot_str = typeof body.endHourSlot === 'string' ? body.endHourSlot : undefined
    const bucket = body.bucket as string | undefined
    const duration = typeof body.duration === 'number' ? body.duration : undefined
    const position = typeof body.position === 'number' ? body.position : undefined
    const repeat_rule = typeof body.repeat_rule === 'string' ? body.repeat_rule : (typeof body.repeatRule === 'string' ? body.repeatRule : undefined)
    const all_day_input = typeof body.all_day === 'boolean' ? body.all_day : (typeof body.allDay === 'boolean' ? body.allDay : undefined)

    if (!content) {
      return NextResponse.json({ error: 'content required' }, { status: 400 })
    }

    const supabase = supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Normalize hourSlot display string from hour_slot number if provided
    const normalizeHourSlot = (value?: number | string): string | undefined => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        const h = Math.max(0, Math.min(23, value))
        const display = h === 0 ? '12AM' : (h < 12 ? `${h}AM` : (h === 12 ? '12PM' : `${h - 12}PM`))
        return `hour-${display}`
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.startsWith('hour-') ? value : `hour-${value.trim()}`
      }
      return undefined
    }

    const hourSlot = normalizeHourSlot(hour_slot ?? hour_slot_str)
    const endHourSlot = normalizeHourSlot(end_hour_slot_num ?? end_hour_slot_str)

    const resolvedStartDate = start_date ?? due_date ?? null
    const resolvedEndDate = end_date_raw ?? resolvedStartDate

    const insert = {
      user_id: user.id,
      content,
      completed: false,
      due_date: resolvedStartDate,
      start_date: resolvedStartDate,
      end_date: resolvedEndDate,
      hour_slot: hourSlot || null,
      end_hour_slot: endHourSlot || null,
      bucket: bucket || null,
      duration: duration ?? null,
      position: position ?? null,
      all_day: all_day_input ?? (!hourSlot && !endHourSlot),
      repeat_rule: repeat_rule ?? null,
    }

    const { data, error } = await supabase
      .from('lifeboard_tasks')
      .insert(insert)
      .select('id, user_id, content, completed, due_date, start_date, end_date, hour_slot, end_hour_slot, bucket, position, duration, repeat_rule, all_day, created_at, updated_at')
      .single()

    if (error) {
      console.error('Supabase insert lifeboard_tasks error', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ task: mapRowToTask(data) })
  } catch (e) {
    console.error('POST /api/tasks error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
