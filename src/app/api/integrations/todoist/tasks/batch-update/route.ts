import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { invalidateTodoistTaskCache } from '@/lib/todoist-task-cache'
import {
  TODOIST_TASKS_ENDPOINT,
  normalizeRepeatRule,
  buildDueString,
  getTodoistToken,
} from '@/lib/todoist/helpers'

interface TaskUpdate {
  taskId: string
  updates: {
    content?: string
    duration?: number
    hourSlot?: string
    endHourSlot?: string | null
    startDate?: string | null
    endDate?: string | null
    allDay?: boolean
    bucket?: string | null
    due?: { date: string }
    position?: number
    [key: string]: unknown
  }
}

export const POST = withAuth(async (req, { supabase, user }) => {
  const { updates }: { updates: TaskUpdate[] } = await req.json()

  if (!updates || !Array.isArray(updates)) {
    return NextResponse.json({ error: 'Invalid updates format' }, { status: 400 })
  }

  // Get Todoist access token
  const tokenResult = await getTodoistToken(supabase, user.id)
  if ('response' in tokenResult) return tokenResult.response
  const accessToken = tokenResult.token

  // Process each update
  const results = []
  let anySuccess = false
  for (const update of updates) {
    try {
      const currentTaskRes = await fetch(`${TODOIST_TASKS_ENDPOINT}/${update.taskId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!currentTaskRes.ok) {
        console.error(`Failed to fetch task ${update.taskId}`)
        continue
      }

      const currentTask = await currentTaskRes.json()

      // Parse existing metadata from description
      let existingMeta = {}
      if (currentTask.description) {
        try {
          const metaMatch = currentTask.description.match(/\[LIFEBOARD_META\](.*?)\[\/LIFEBOARD_META\]/)
          if (metaMatch) {
            existingMeta = JSON.parse(metaMatch[1])
          }
        } catch (e) {
          console.warn(`Failed to parse metadata for task ${update.taskId}:`, e)
        }
      }

      // Merge updates with existing metadata
      const newMeta: Record<string, unknown> = {
        ...existingMeta,
        ...(update.updates.duration !== undefined && { duration: update.updates.duration }),
        ...(update.updates.hourSlot !== undefined && { hourSlot: update.updates.hourSlot }),
        ...(update.updates.endHourSlot !== undefined && { endHourSlot: update.updates.endHourSlot }),
        ...(update.updates.startDate !== undefined && { startDate: update.updates.startDate }),
        ...(update.updates.endDate !== undefined && { endDate: update.updates.endDate }),
        ...(update.updates.allDay !== undefined && { allDay: update.updates.allDay }),
        ...(update.updates.bucket !== undefined && { bucket: update.updates.bucket }),
        ...(update.updates.position !== undefined && { position: update.updates.position }),
      }

      const rawRepeatRule = update.updates.repeatRule
      const normalizedRepeatRule = typeof rawRepeatRule === 'string' ? normalizeRepeatRule(rawRepeatRule) : undefined
      const removeRepeatRule = rawRepeatRule === null || (typeof rawRepeatRule === 'string' && rawRepeatRule.trim().toLowerCase() === 'none')
      if (normalizedRepeatRule) {
        newMeta.repeatRule = normalizedRepeatRule
      }

      // Handle null values by removing them from metadata
      if (update.updates.hourSlot === null) delete newMeta.hourSlot
      if (update.updates.endHourSlot === null) delete newMeta.endHourSlot
      if (update.updates.duration === null) delete newMeta.duration
      if (update.updates.bucket === null) delete newMeta.bucket
      if (update.updates.position === null) delete newMeta.position
      if (update.updates.startDate === null) delete newMeta.startDate
      if (update.updates.endDate === null) delete newMeta.endDate
      if (update.updates.allDay === null) delete newMeta.allDay
      if (removeRepeatRule) delete newMeta.repeatRule

      const metaKeys = Object.keys(newMeta).filter(key => newMeta[key] !== undefined)
      const baseDescription = currentTask.description?.replace(/\[LIFEBOARD_META\].*?\[\/LIFEBOARD_META\]/g, '').trim() || ''
      const newDescription = metaKeys.length > 0
        ? `${baseDescription}${baseDescription ? '\n' : ''}[LIFEBOARD_META]${JSON.stringify(newMeta)}[/LIFEBOARD_META]`
        : baseDescription

      // Prepare update payload for Todoist
      const todoistUpdate: Record<string, unknown> = {}

      if (update.updates.content) {
        todoistUpdate.content = update.updates.content
      }

      const dueUpdate = update.updates.due
      const dueDateValue = dueUpdate?.date ?? undefined

      if (normalizedRepeatRule) {
        const startingDate = dueDateValue || currentTask?.due?.date || null
        const dueString = buildDueString(normalizedRepeatRule, startingDate)
        if (dueString) {
          todoistUpdate.due_string = dueString
        }
      } else if (removeRepeatRule) {
        if (dueDateValue) {
          todoistUpdate.due_date = dueDateValue
        } else if (dueUpdate === null || dueDateValue === undefined) {
          todoistUpdate.due_string = 'no date'
        }
      } else if (dueUpdate !== undefined) {
        if (dueDateValue) {
          todoistUpdate.due_date = dueDateValue
        } else if (dueUpdate === null) {
          todoistUpdate.due_string = 'no date'
        }
      }

      todoistUpdate.description = newDescription.trim()

      const updateRes = await fetch(`${TODOIST_TASKS_ENDPOINT}/${update.taskId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(todoistUpdate),
      })

      if (updateRes.ok) {
        const updatedTask = await updateRes.json()
        anySuccess = true
        results.push({ taskId: update.taskId, success: true, updatedTask })
      } else {
        const errorText = await updateRes.text()
        console.error(`Failed to update task ${update.taskId}:`, {
          status: updateRes.status,
          error: errorText,
          updates: update.updates,
        })
        results.push({ taskId: update.taskId, success: false, error: errorText, status: updateRes.status })
      }
    } catch (error) {
      console.error(`Error updating task ${update.taskId}:`, error)
      results.push({ taskId: update.taskId, success: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (anySuccess) {
    invalidateTodoistTaskCache(user.id)
  }

  return NextResponse.json({ results })
}, 'POST /api/integrations/todoist/tasks/batch-update')
