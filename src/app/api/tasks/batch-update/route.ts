import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { syncTaskToCalendarEvent } from '@/lib/calendar-sync'

export const POST = withAuth(async (req, { supabase, user }) => {
  const { updates } = await req.json()
  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: 'updates array required' }, { status: 400 })
  }

  const results: Record<string, unknown>[] = []
  for (const u of updates) {
    const taskId = u.taskId?.toString?.()
    const patch = u.updates || {}
    if (!taskId) continue

    // Translate fields to DB columns
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof patch.content === 'string') updateData.content = patch.content
    if (typeof patch.completed === 'boolean') updateData.completed = patch.completed
    const normalizeHourSlot = (value: unknown): string | null => {
      if (typeof value === 'string' && value.trim().length > 0) {
        const trimmed = value.trim()
        return trimmed.startsWith('hour-') ? trimmed : `hour-${trimmed}`
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        const h = Math.max(0, Math.min(23, value))
        const display = h === 0 ? '12AM' : (h < 12 ? `${h}AM` : (h === 12 ? '12PM' : `${h - 12}PM`))
        return `hour-${display}`
      }
      return null
    }

    if (patch.startDate !== undefined) updateData.start_date = patch.startDate ?? null
    if (patch.endDate !== undefined) updateData.end_date = patch.endDate ?? null
    if (patch.due !== undefined) updateData.due_date = patch.due?.date ?? null
    else if (patch.startDate !== undefined) updateData.due_date = patch.startDate ?? null

    if (patch.hourSlot !== undefined) updateData.hour_slot = normalizeHourSlot(patch.hourSlot)
    if (patch.endHourSlot !== undefined) updateData.end_hour_slot = normalizeHourSlot(patch.endHourSlot)
    if (patch.allDay !== undefined) updateData.all_day = patch.allDay
    if (patch.bucket !== undefined) updateData.bucket = patch.bucket ?? null
    if (patch.repeatRule !== undefined) updateData.repeat_rule = patch.repeatRule ?? null
    if (typeof patch.position === 'number') updateData.position = patch.position
    if (typeof patch.duration === 'number') updateData.duration = patch.duration
    if (typeof patch.kanbanStatus === 'string') updateData.kanban_status = patch.kanbanStatus
    if (patch.assigneeId !== undefined) updateData.assignee_id = patch.assigneeId ?? null
    if (updateData.due_date === undefined && updateData.start_date !== undefined) {
      updateData.due_date = updateData.start_date
    }

    const { data, error } = await supabase
      .from('lifeboard_tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('user_id', user.id)
      .select('id, content, due_date, start_date, end_date, hour_slot, end_hour_slot, duration, repeat_rule, bucket, completed, position, all_day, kanban_status, assignee_id')
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
          start_date: data.start_date,
          end_date: data.end_date,
          hour_slot: data.hour_slot,
          end_hour_slot: data.end_hour_slot,
          duration: data.duration,
          repeat_rule: data.repeat_rule,
          bucket: data.bucket,
          completed: data.completed,
          position: data.position,
          all_day: data.all_day,
        })
      } catch (syncError) {
        console.error('Failed to sync calendar event after task update', { taskId, syncError })
      }
    }
    results.push({ id: taskId, ok: !error })
  }

  return NextResponse.json({ ok: true, results })
}, 'POST /api/tasks/batch-update')
