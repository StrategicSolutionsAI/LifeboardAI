import { NextResponse } from 'next/server'
import { withAuthAndBody } from '@/lib/api-utils'
import { z } from 'zod'

const schema = z.object({ taskId: z.string().min(1) })

export const POST = withAuthAndBody(schema, async (_req, { supabase, user, body }) => {
  const { error } = await supabase
    .from('lifeboard_tasks')
    .update({ completed: true, updated_at: new Date().toISOString() })
    .eq('id', body.taskId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Supabase complete task error', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}, 'POST /api/tasks/complete')
