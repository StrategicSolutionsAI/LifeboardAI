import { NextResponse } from 'next/server'
import { withAuthAndBody } from '@/lib/api-utils'
import { invalidateTodoistTaskCache } from '@/lib/todoist-task-cache'
import { TODOIST_TASKS_ENDPOINT, getTodoistToken } from '@/lib/todoist/helpers'
import { z } from 'zod'

const schema = z.object({
  taskId: z.string().min(1),
  dueDate: z.string().nullable().optional(),
})

export const POST = withAuthAndBody(schema, async (_req, { supabase, user, body }) => {
  const tokenResult = await getTodoistToken(supabase, user.id)
  if ('response' in tokenResult) return tokenResult.response
  const accessToken = tokenResult.token

  const todoistBody: Record<string, string> = {}
  if (body.dueDate === null) {
    todoistBody.due_string = 'no date'
  } else if (typeof body.dueDate === 'string') {
    todoistBody.due_date = body.dueDate
  }

  const res = await fetch(`${TODOIST_TASKS_ENDPOINT}/${body.taskId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(todoistBody),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Todoist update response', text)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }

  invalidateTodoistTaskCache(user.id)
  return NextResponse.json({ ok: true })
}, 'POST /api/integrations/todoist/tasks/update')
