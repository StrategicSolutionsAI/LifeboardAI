import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import {
  readTodoistTaskCache,
  writeTodoistTaskCache,
  getTodoistPendingFetch,
  setTodoistPendingFetch,
  clearTodoistPendingFetch,
  invalidateTodoistTaskCache
} from '@/lib/todoist-task-cache'
import {
  TODOIST_TASKS_ENDPOINT,
  normalizeRepeatRule,
  buildDueString,
  getTodoistToken,
} from '@/lib/todoist/helpers'
import type { RepeatRule } from '@/lib/todoist/helpers'

interface TodoistDue {
  date?: string
  datetime?: string
  is_recurring?: boolean
  string?: string
}

interface TodoistApiTask {
  id: string
  content: string
  description?: string
  due?: TodoistDue
  position?: number
  [key: string]: unknown
}

class TodoistFetchError extends Error {
  status: number
  body?: string

  constructor(status: number, body?: string) {
    super(`Todoist request failed with status ${status}`)
    this.status = status
    this.body = body
  }
}

const filterTasksByDate = (tasks: TodoistApiTask[], date: string) =>
  tasks.filter((task: TodoistApiTask) => {
    const due = task?.due
    if (!due) return false
    if (typeof due.date === 'string') {
      return due.date.slice(0, 10) === date
    }
    if (typeof due.datetime === 'string') {
      return due.datetime.slice(0, 10) === date
    }
    return false
  })

const sortTasksByPosition = (tasks: TodoistApiTask[]) => {
  const sorted = [...tasks]
  sorted.sort((a: TodoistApiTask, b: TodoistApiTask) => {
    const posA = a?.position ?? Number.MAX_SAFE_INTEGER
    const posB = b?.position ?? Number.MAX_SAFE_INTEGER
    return posA - posB
  })
  return sorted
}

const enhanceTodoistTask = (task: TodoistApiTask) => {
  let metadata: {
    duration?: number
    hourSlot?: string
    endHourSlot?: string
    bucket?: string
    position?: number
    repeatRule?: RepeatRule
    startDate?: string
    endDate?: string
    allDay?: boolean
  } = {}
  let cleanContent = task.content

  if (task.description) {
    try {
      const metaMatch = task.description.match(/\[LIFEBOARD_META\](.*?)\[\/LIFEBOARD_META\]/)
      if (metaMatch) {
        metadata = JSON.parse(metaMatch[1])
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  if (task.content) {
    try {
      const contentMetaMatch = task.content.match(/^(.*?)\s*\[LIFEBOARD_META\].*?\[\/LIFEBOARD_META\]$/)
      if (contentMetaMatch) {
        cleanContent = contentMetaMatch[1].trim()

        if (Object.keys(metadata).length === 0) {
          const metaMatch = task.content.match(/\[LIFEBOARD_META\](.*?)\[\/LIFEBOARD_META\]/)
          if (metaMatch) {
            metadata = JSON.parse(metaMatch[1])
          }
        }
      }
    } catch (e) {
      // Ignore parsing errors, keep original content
    }
  }

  return {
    ...task,
    content: cleanContent,
    duration: metadata.duration,
    hourSlot: metadata.hourSlot,
    endHourSlot: metadata.endHourSlot,
    bucket: metadata.bucket,
    position: metadata.position,
    repeatRule: metadata.repeatRule ?? (task.due?.is_recurring ? normalizeRepeatRule(task.due?.string) : undefined),
    startDate: metadata.startDate ?? task.due?.date ?? task.due?.datetime?.slice(0, 10),
    endDate: metadata.endDate ?? metadata.startDate ?? task.due?.date ?? task.due?.datetime?.slice(0, 10),
    allDay: metadata.allDay ?? (!metadata.hourSlot && !metadata.endHourSlot),
  }
}

export const GET = withAuth(async (req, { supabase, user }) => {
  const searchParams = req.nextUrl.searchParams
  const date = searchParams.get('date') // YYYY-MM-DD
  const allParam = searchParams.get('all')

  if (!date && !allParam) {
    return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 })
  }

  // Get Todoist access token
  const tokenResult = await getTodoistToken(supabase, user.id)
  if ('response' in tokenResult) return tokenResult.response
  const accessToken = tokenResult.token

  const respondWithTasks = (tasks: TodoistApiTask[]) => {
    if (date && !allParam) {
      return NextResponse.json({ tasks: filterTasksByDate(tasks, date) })
    }
    if (allParam) {
      return NextResponse.json({ tasks: sortTasksByPosition(tasks) })
    }
    return NextResponse.json({ tasks })
  }

  // Allow clients to bypass server-side cache
  const nocache = searchParams.get('nocache') === '1'
  if (nocache) {
    invalidateTodoistTaskCache(user.id)
  }

  const cachedTasks = readTodoistTaskCache(user.id)
  if (cachedTasks) {
    return respondWithTasks(cachedTasks)
  }

  const pending = getTodoistPendingFetch(user.id)
  if (pending) {
    try {
      const tasks = await pending
      return respondWithTasks(tasks)
    } catch (err) {
      clearTodoistPendingFetch(user.id)
      throw err
    }
  }

  const fetchPromise = (async () => {
    const todoistRes = await fetch(TODOIST_TASKS_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!todoistRes.ok) {
      const text = await todoistRes.text().catch(() => '')
      throw new TodoistFetchError(todoistRes.status, text)
    }

    const tasks = await todoistRes.json()
    const list = Array.isArray(tasks) ? tasks : []
    return list.map(enhanceTodoistTask)
  })()

  setTodoistPendingFetch(user.id, fetchPromise)

  let enhancedTasks: TodoistApiTask[]
  try {
    enhancedTasks = await fetchPromise
  } catch (err) {
    clearTodoistPendingFetch(user.id)
    if (err instanceof TodoistFetchError) {
      console.error('Todoist API error', err.status, err.body)
      if (err.status === 401 || err.status === 403) {
        return NextResponse.json({ error: 'Todoist auth error', status: err.status }, { status: 401 })
      }
      if (err.status === 429) {
        return NextResponse.json({ error: 'Todoist rate limited', status: 429 }, { status: 429 })
      }
      const body = (err.body || '').slice(0, 400)
      return NextResponse.json({ error: 'Todoist API error', status: 502, upstreamStatus: err.status, upstreamBody: body }, { status: 502 })
    }
    throw err
  }

  // Avoid repopulating cache with stale data from an outdated in-flight request.
  if (getTodoistPendingFetch(user.id) === fetchPromise) {
    clearTodoistPendingFetch(user.id)
    writeTodoistTaskCache(user.id, enhancedTasks)
  }

  return respondWithTasks(enhancedTasks)
}, 'GET /api/integrations/todoist/tasks')

export const POST = withAuth(async (req, { supabase, user }) => {
  const {
    content,
    dueDate,
    due_date,
    hour_slot,
    hourSlot,
    end_hour_slot,
    endHourSlot,
    start_date,
    startDate,
    end_date,
    endDate,
    all_day,
    allDay,
    bucket,
    repeat_rule,
    repeatRule
  } = await req.json()
  let actualDueDate: string | null = (dueDate || due_date) || null
  const requestedRepeat = typeof repeat_rule === 'string' ? repeat_rule : (typeof repeatRule === 'string' ? repeatRule : undefined)
  const repeatRuleNormalized = normalizeRepeatRule(requestedRepeat)
  const normalizedStartDate = (startDate ?? start_date) || actualDueDate
  const normalizedEndDate = (endDate ?? end_date) || normalizedStartDate

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const postTokenResult = await getTodoistToken(supabase, user.id)
  if ('response' in postTokenResult) return postTokenResult.response
  const postAccessToken = postTokenResult.token

  const normalizeHourValue = (value: unknown): string | undefined => {
    if (typeof value === 'number') {
      const h = Math.max(0, Math.min(23, value))
      const display = (() => {
        if (h === 0) return '12AM'
        if (h < 12) return `${h}AM`
        if (h === 12) return '12PM'
        return `${h - 12}PM`
      })()
      return `hour-${display}`
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const trimmed = value.trim()
      return trimmed.startsWith('hour-') ? trimmed : `hour-${trimmed}`
    }
    return undefined
  }

  const metadata: {
    hourSlot?: string
    endHourSlot?: string
    bucket?: string
    repeatRule?: RepeatRule
    startDate?: string
    endDate?: string
    allDay?: boolean
  } = {}

  const normalizedHourSlot = normalizeHourValue(hour_slot ?? hourSlot)
  if (normalizedHourSlot) {
    metadata.hourSlot = normalizedHourSlot
  }
  const normalizedEndHourSlot = normalizeHourValue(end_hour_slot ?? endHourSlot)
  if (normalizedEndHourSlot) {
    metadata.endHourSlot = normalizedEndHourSlot
  }
  if (bucket) metadata.bucket = bucket
  if (repeatRuleNormalized) metadata.repeatRule = repeatRuleNormalized
  if (normalizedStartDate) metadata.startDate = normalizedStartDate
  if (normalizedEndDate) metadata.endDate = normalizedEndDate
  const allDayValue = typeof allDay === 'boolean' ? allDay : (typeof all_day === 'boolean' ? all_day : undefined)
  if (allDayValue !== undefined) metadata.allDay = allDayValue

  if (typeof hour_slot === 'number') {
    const h = Math.max(0, Math.min(23, hour_slot))
    const display = (() => {
      if (h === 0) return '12AM'
      if (h < 12) return `${h}AM`
      if (h === 12) return '12PM'
      return `${h - 12}PM`
    })()
    metadata.hourSlot = `hour-${display}`
  }

  // Normalize obviously stale years
  if (actualDueDate && /^\d{4}-\d{2}-\d{2}$/.test(actualDueDate)) {
    try {
      const yr = Number(actualDueDate.slice(0, 4))
      const nowYr = new Date().getFullYear()
      if (yr < nowYr) {
        actualDueDate = `${nowYr}${actualDueDate.slice(4)}`
      }
    } catch {}
  }

  const body: Record<string, string> = { content }
  if (repeatRuleNormalized) {
    const dueString = buildDueString(repeatRuleNormalized, actualDueDate)
    if (dueString) {
      body['due_string'] = dueString
    }
  } else if (actualDueDate) {
    body['due_date'] = actualDueDate
  }

  // Store metadata in description field instead of content
  const metaEntries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null)
  if (metaEntries.length > 0) {
    body['description'] = `[LIFEBOARD_META]${JSON.stringify(Object.fromEntries(metaEntries))}[/LIFEBOARD_META]`
  }

  const todoistRes = await fetch(TODOIST_TASKS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${postAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!todoistRes.ok) {
    const text = await todoistRes.text()
    console.error('Todoist create task error', todoistRes.status, (text || '').slice(0, 200))
    return NextResponse.json({ error: 'Todoist API error', status: todoistRes.status }, { status: 502 })
  }

  const task = await todoistRes.json()
  invalidateTodoistTaskCache(user.id)
  return NextResponse.json({ task })
}, 'POST /api/integrations/todoist/tasks')
