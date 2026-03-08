import { NextResponse } from 'next/server'
import { withAuthAndBody } from '@/lib/api-utils'
import { z } from 'zod'

const schema = z.object({ taskId: z.string().min(1) })

export const DELETE = withAuthAndBody(schema, async (_req, { supabase, user, body }) => {
  const { error } = await supabase
    .from('lifeboard_tasks')
    .delete()
    .eq('id', body.taskId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Supabase delete task error', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Clean up associated calendar events and task occurrence exceptions
  const [calendarResult, exceptionsResult] = await Promise.all([
    supabase
      .from('calendar_events')
      .delete()
      .eq('task_id', body.taskId)
      .eq('user_id', user.id),
    supabase
      .from('task_occurrence_exceptions')
      .delete()
      .eq('task_id', body.taskId)
      .eq('user_id', user.id),
  ])

  if (calendarResult.error) {
    console.error('Failed to delete associated calendar event', { taskId: body.taskId, error: calendarResult.error })
  }
  if (exceptionsResult.error) {
    console.error('Failed to delete associated task occurrence exceptions', { taskId: body.taskId, error: exceptionsResult.error })
  }

  return NextResponse.json({ ok: true })
}, 'DELETE /api/tasks/delete')
