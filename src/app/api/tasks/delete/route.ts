import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

export async function DELETE(request: NextRequest) {
  try {
    const { taskId } = await request.json()
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

    const supabase = supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { error } = await supabase
      .from('lifeboard_tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Supabase delete task error', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const { error: calendarError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', user.id)

    if (calendarError) {
      console.error('Failed to delete associated calendar event', { taskId, calendarError })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/tasks/delete error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
