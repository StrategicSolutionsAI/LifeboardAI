import { NextResponse } from 'next/server'
import { withAuthAndBody } from '@/lib/api-utils'
import { invalidateTodoistTaskCache } from '@/lib/todoist-task-cache'
import { TODOIST_TASKS_ENDPOINT, getTodoistToken } from '@/lib/todoist/helpers'
import { z } from 'zod'

const schema = z.object({ taskId: z.string().min(1) })

export const DELETE = withAuthAndBody(schema, async (_req, { supabase, user, body }) => {
  const tokenResult = await getTodoistToken(supabase, user.id)
  if ('response' in tokenResult) return tokenResult.response
  const accessToken = tokenResult.token

  const res = await fetch(`${TODOIST_TASKS_ENDPOINT}/${body.taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Todoist delete response', text)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }

  invalidateTodoistTaskCache(user.id)
  return NextResponse.json({ ok: true })
}, 'DELETE /api/integrations/todoist/tasks/delete')
