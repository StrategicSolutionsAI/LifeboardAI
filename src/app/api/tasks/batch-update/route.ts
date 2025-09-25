import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { syncTaskToCalendarEvent } from '@/lib/calendar-sync'

export async function POST(request: NextRequest) {
  try {
    const { updates } = await request.json()
    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'updates array required' }, { status: 400 })
    }

    const supabase = supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const results: any[] = []
    for (const u of updates) {
      const taskId = u.taskId?.toString?.()
      const patch = u.updates || {}
      if (!taskId) continue

      // Translate fields to DB columns
      const updateData: any = { updated_at: new Date().toISOString() }
      if (typeof patch.content === 'string') updateData.content = patch.content
      if (typeof patch.completed === 'boolean') updateData.completed = patch.completed
      if (patch.due) updateData.due_date = patch.due?.date ?? null
      if (patch.hourSlot !== undefined) updateData.hour_slot = patch.hourSlot ?? null
      if (patch.bucket !== undefined) updateData.bucket = patch.bucket ?? null
      if (patch.repeatRule !== undefined) updateData.repeat_rule = patch.repeatRule ?? null
      if (typeof patch.position === 'number') updateData.position = patch.position
      if (typeof patch.duration === 'number') updateData.duration = patch.duration

      const { data, error } = await supabase
        .from('lifeboard_tasks')
        .update(updateData)
        .eq('id', taskId)
        .eq('user_id', user.id)
        .select('id, content, due_date, hour_slot, duration, repeat_rule, bucket, completed, position')
        .single()
      if (error) {
        console.warn('Supabase batch update error for', taskId, error)
      }
      if (!error && data) {
        try {
          await syncTaskToCalendarEvent(supabase, user.id, {
            id: data.id,
            content: data.content,
            due_date: data.due_date,
            hour_slot: data.hour_slot,
            duration: data.duration,
            repeat_rule: data.repeat_rule,
            bucket: data.bucket,
            completed: data.completed,
            position: data.position,
          })
        } catch (syncError) {
          console.error('Failed to sync calendar event after task update', { taskId, syncError })
        }
      }
      results.push({ id: taskId, ok: !error })
    }

    return NextResponse.json({ ok: true, results })
  } catch (e) {
    console.error('POST /api/tasks/batch-update error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
