import { NextResponse } from 'next/server'
import { withAuthAndBody } from '@/lib/api-utils'
import { getDataScope, ownedOrShared } from '@/lib/household/scope'
import { z } from 'zod'

const schema = z.object({ taskId: z.string().min(1) })

export const POST = withAuthAndBody(schema, async (_req, { supabase, user, body }) => {
  const scope = await getDataScope(supabase, user.id)
  const { error } = await supabase
    .from('lifeboard_tasks')
    .update({ completed: true, updated_at: new Date().toISOString() })
    .eq('id', body.taskId)
    .or(ownedOrShared(scope))

  if (error) {
    console.error('Supabase complete task error', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}, 'POST /api/tasks/complete')
