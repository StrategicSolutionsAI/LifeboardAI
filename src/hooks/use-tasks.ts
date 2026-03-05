import { useCallback, useMemo, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { OccurrenceDecision, useOccurrencePrompt } from '@/contexts/tasks-occurrence-prompt-context'
import { useDataCache } from './use-data-cache'

// Types now live in @/types/tasks — re-exported for backward compatibility
export type { RepeatRule, RepeatOption, KanbanStatus, TaskDue, Task, TaskOccurrenceException } from '@/types/tasks'
import type { Task, RepeatRule, RepeatOption, KanbanStatus, TaskDue, TaskOccurrenceException, TaskOccurrenceExceptionUpsertInput } from '@/types/tasks'

const inferSourceFromId = (id?: string): Task['source'] => {
  if (!id) return 'supabase'
  if (/^\d+$/.test(id)) return 'todoist'
  if (id.startsWith('local-')) return 'local'
  return 'supabase'
}

const ensureTaskSource = (task: Task, fallback?: Task['source']): Task => {
  if (!task) return task
  const source = task.source ?? fallback ?? inferSourceFromId(task.id)
  return task.source === source ? task : { ...task, source }
}

const ensureTasksSource = (tasks: Task[] | null | undefined, fallback?: Task['source']): Task[] =>
  (tasks || []).map(task => ensureTaskSource(task, fallback))

const EXTERNAL_FETCH_TIMEOUT_MS = 4500

const isAbortLikeError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('abort') || message.includes('aborted')
  }
  return false
}

const isNetworkFetchError = (error: unknown): boolean => {
  return error instanceof TypeError && error.message.includes('Failed to fetch')
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = EXTERNAL_FETCH_TIMEOUT_MS
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

interface TaskUpdate {
  taskId: string
  updates: Partial<Task>
}

// Module-level: persists across navigations so we don't re-probe Todoist on every page mount
let _todoistConnected: boolean | null = null

// Module-level cache for occurrence exceptions to avoid re-fetching on every page mount
let _occurrenceExceptionsCache: { data: TaskOccurrenceException[]; ts: number } | null = null
const OCCURRENCE_CACHE_TTL = 60_000 // 60s

// Custom hook for managing tasks with optimistic updates
export function useTasks(selectedDate?: Date) {
  // Module-level ref wrapper so closures inside useCallback always see the latest value
  const todoistConnectedRef = useRef<boolean | null>(_todoistConnected)
  // Keep module-level state in sync
  const setTodoistConnected = (v: boolean | null) => {
    _todoistConnected = v
    todoistConnectedRef.current = v
  }
  const lastSeenUpdateRef = useRef<number>(0)
  const sharedFetchRef = useRef<Promise<Task[]> | null>(null)
  // Cache the last resolved result for 30s so the daily fetcher doesn't re-fetch
  const sharedResultRef = useRef<{ data: Task[]; ts: number } | null>(null)
  const SHARED_RESULT_TTL = 30_000
  const promptOccurrenceDecision = useOccurrencePrompt()
  const [occurrenceExceptions, setOccurrenceExceptions] = useState<TaskOccurrenceException[]>([])
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track timestamps of updates we made locally so we don't refetch and clobber our own optimistic state
  const localUpdateTimestamps = useRef<Set<number>>(new Set())
  // When true, the next fetch will bypass server-side Todoist cache (set by chat-created tasks)
  const nocacheRef = useRef(false)

  const refreshOccurrenceExceptions = useCallback(async (force = false) => {
    if (typeof window === 'undefined') return
    // Return cached data if fresh (avoids re-fetching on every page navigation)
    if (!force && _occurrenceExceptionsCache && Date.now() - _occurrenceExceptionsCache.ts < OCCURRENCE_CACHE_TTL) {
      setOccurrenceExceptions(_occurrenceExceptionsCache.data)
      return
    }
    try {
      const res = await fetch('/api/task-occurrence-exceptions', {
        credentials: 'same-origin'
      })
      if (!res.ok) {
        console.warn('Failed to load task occurrence exceptions', res.status)
        return
      }
      const json = await res.json().catch(() => ({}))
      const list = Array.isArray(json?.exceptions) ? json.exceptions as TaskOccurrenceException[] : []
      _occurrenceExceptionsCache = { data: list, ts: Date.now() }
      setOccurrenceExceptions(list)
    } catch (error) {
      console.warn('Failed to refresh task occurrence exceptions', error)
    }
  }, [])

  useEffect(() => {
    refreshOccurrenceExceptions()
  }, [refreshOccurrenceExceptions])

  const upsertOccurrenceException = useCallback(async (input: TaskOccurrenceExceptionUpsertInput) => {
    const payload: Record<string, any> = {
      taskId: input.taskId,
      occurrenceDate: input.occurrenceDate,
      skip: input.skip ?? false,
    }

    if ('overrideHourSlot' in input) payload.overrideHourSlot = input.overrideHourSlot
    if ('overrideDuration' in input) payload.overrideDuration = input.overrideDuration
    if ('overrideBucket' in input) payload.overrideBucket = input.overrideBucket

    try {
      const res = await fetch('/api/task-occurrence-exceptions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText)
        throw new Error(errorText || `Failed to upsert occurrence exception (${res.status})`)
      }
      const json = await res.json().catch(() => ({}))
      const exception = json?.exception as TaskOccurrenceException | undefined
      if (exception) {
        setOccurrenceExceptions(prev => {
          const next = prev.filter(item => !(item.taskId === exception.taskId && item.occurrenceDate === exception.occurrenceDate))
          next.push(exception)
          return next
        })
      }
      return exception
    } catch (error) {
      console.warn('Failed to upsert occurrence exception', error)
      throw error
    }
  }, [])

  const occurrenceExceptionIndex = useMemo(() => {
    const map = new Map<string, Map<string, TaskOccurrenceException>>()
    occurrenceExceptions.forEach(exception => {
      if (!exception?.taskId || !exception.occurrenceDate) return
      if (!map.has(exception.taskId)) {
        map.set(exception.taskId, new Map())
      }
      map.get(exception.taskId)!.set(exception.occurrenceDate, exception)
    })
    return map
  }, [occurrenceExceptions])

  const applyOccurrenceAdjustments = useCallback((task: Task, occurrenceDate: string): Task | null => {
    const perTask = occurrenceExceptionIndex.get(task.id)
    if (!perTask) return task
    const exception = perTask.get(occurrenceDate)
    if (!exception) return task
    if (exception.skip) return null

    let next: Task = task
    let mutated = false

    if (exception.overrideHourSlot !== undefined) {
      if (!exception.overrideHourSlot) {
        return null
      }
      next = mutated ? next : { ...task }
      next.hourSlot = exception.overrideHourSlot ?? undefined
      mutated = true
    }

    if (exception.overrideDuration !== undefined) {
      next = mutated ? next : { ...task }
      next.duration = exception.overrideDuration ?? undefined
      mutated = true
    }

    if (exception.overrideBucket !== undefined) {
      next = mutated ? next : { ...task }
      next.bucket = exception.overrideBucket ?? undefined
      mutated = true
    }

    return next
  }, [occurrenceExceptionIndex])

  const getTaskForOccurrence = useCallback(
    (task: Task, occurrenceDate: string): Task | null =>
      applyOccurrenceAdjustments(task, occurrenceDate),
    [applyOccurrenceAdjustments]
  )

  const dateStr = selectedDate 
    ? format(selectedDate, 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd')
  
  
  // Cache key includes date for date-specific tasks
  const dailyCacheKey = `tasks-daily-${dateStr}`
  const allCacheKey = 'tasks-all-open'

  const fetchAllOpenTasks = useCallback(async (): Promise<Task[]> => {
    if (sharedFetchRef.current) {
      return sharedFetchRef.current
    }

    // Return recently resolved result to prevent duplicate fetches
    // (e.g. daily fetcher calling this right after prefetch resolved)
    if (sharedResultRef.current && Date.now() - sharedResultRef.current.ts < SHARED_RESULT_TTL) {
      return sharedResultRef.current.data
    }

    const inflight = (async () => {
      const readSupabaseTasks = async (): Promise<Task[] | null> => {
        try {
          const supa = await fetchWithTimeout('/api/tasks?all=true', { credentials: 'same-origin' })
          if (!supa.ok) return null
          const json = await supa.json()
          const supabaseTasks = Array.isArray(json) ? json : (json.tasks ?? [])
          return ensureTasksSource(supabaseTasks as Task[], 'supabase')
        } catch {
          return null
        }
      }

      const readLocalTasks = (): Task[] => {
        try {
          if (typeof window === 'undefined') return []
          const raw = window.localStorage.getItem('lifeboard_local_tasks')
          const list: Task[] = raw ? JSON.parse(raw) : []
          const normalized = ensureTasksSource(list, 'local')
          return normalized.filter(t => !t.completed)
        } catch {
          return []
        }
      }

      const fallbackToSupabaseOrLocal = async (): Promise<Task[]> => {
        const supabaseTasks = await readSupabaseTasks()
        const localTasks = readLocalTasks()
        if (supabaseTasks) {
          // Include both Supabase and local tasks (local tasks are pending sync)
          if (localTasks.length > 0) {
            const taskMap = new Map<string, Task>()
            localTasks.forEach(t => taskMap.set(t.id, t))
            supabaseTasks.forEach(t => taskMap.set(t.id, t))
            return Array.from(taskMap.values())
          }
          return supabaseTasks
        }
        return localTasks
      }

      try {
        // If we already know Todoist is not connected, skip trying it
        if (todoistConnectedRef.current === false) {
          const fallback = await fallbackToSupabaseOrLocal()
          sharedResultRef.current = { data: fallback, ts: Date.now() }
          return fallback
        }

        const todoistUrl = nocacheRef.current
          ? '/api/integrations/todoist/tasks?all=true&nocache=1'
          : '/api/integrations/todoist/tasks?all=true'
        nocacheRef.current = false

        // Fire Todoist and Supabase fetches in PARALLEL instead of serial
        const [todoistResult, supabaseResult] = await Promise.all([
          fetchWithTimeout(todoistUrl, { credentials: 'same-origin' })
            .then(async (res) => {
              if (!res.ok) {
                if (res.status === 400 || res.status === 401) {
                  setTodoistConnected(false)
                  return { ok: false as const, tasks: [] as Task[] }
                }
                if (res.status >= 500 || res.status === 429) {
                  let upstreamStatus: number | null = null
                  try {
                    const payload = await res.clone().json()
                    const reported = Number(payload?.upstreamStatus ?? payload?.status)
                    if (Number.isFinite(reported)) upstreamStatus = reported
                  } catch {}
                  if (upstreamStatus === 401 || upstreamStatus === 403 || upstreamStatus === 410) {
                    setTodoistConnected(false)
                  }
                  console.warn(
                    `Upstream error fetching tasks: ${res.status}${upstreamStatus ? ` (upstream ${upstreamStatus})` : ''}. Falling back to Supabase/local.`
                  )
                  return { ok: false as const, tasks: [] as Task[] }
                }
                throw new Error(`Failed to fetch tasks: ${res.status}`)
              }
              const data = await res.json()
              setTodoistConnected(true)
              const raw: Task[] = Array.isArray(data) ? data : (data.tasks ?? [])
              return { ok: true as const, tasks: ensureTasksSource(raw, 'todoist') }
            })
            .catch((error) => {
              if (isNetworkFetchError(error) || isAbortLikeError(error)) {
                setTodoistConnected(false)
                return { ok: false as const, tasks: [] as Task[] }
              }
              throw error
            }),
          // Supabase fetch runs in parallel — no longer waits for Todoist
          fetchWithTimeout('/api/tasks?all=true', { credentials: 'same-origin' })
            .then(async (supa) => {
              if (!supa.ok) return [] as Task[]
              const json = await supa.json()
              const raw = Array.isArray(json) ? json : (json.tasks ?? [])
              return ensureTasksSource(raw as Task[], 'supabase')
            })
            .catch((error) => {
              console.warn('Failed to fetch Supabase tasks:', error)
              return [] as Task[]
            }),
        ])

        // If Todoist failed entirely, fall back to Supabase + local
        if (!todoistResult.ok && supabaseResult.length === 0) {
          return fallbackToSupabaseOrLocal()
        }

        const todoistTasks = todoistResult.tasks
        const supabaseTasks = supabaseResult

        // Merge: Supabase first, Todoist overwrites duplicates
        const taskMap = new Map<string, Task>()
        supabaseTasks.forEach((task: Task) => taskMap.set(task.id, task))
        todoistTasks.forEach((task: Task) => taskMap.set(task.id, task))

        // If Todoist failed but Supabase has data, include local tasks too
        if (!todoistResult.ok) {
          const localTasks = (() => {
            try {
              if (typeof window === 'undefined') return []
              const raw = window.localStorage.getItem('lifeboard_local_tasks')
              const list: Task[] = raw ? JSON.parse(raw) : []
              return ensureTasksSource(list, 'local').filter(t => !t.completed)
            } catch { return [] }
          })()
          localTasks.forEach(t => taskMap.set(t.id, t))
        }

        const merged = Array.from(taskMap.values())
        sharedResultRef.current = { data: merged, ts: Date.now() }
        return merged
      } catch (error) {
        if (isNetworkFetchError(error) || isAbortLikeError(error)) {
          setTodoistConnected(false)
          const fallback = await fallbackToSupabaseOrLocal()
          sharedResultRef.current = { data: fallback, ts: Date.now() }
          return fallback
        }
        throw error
      } finally {
        sharedFetchRef.current = null
      }
    })()

    sharedFetchRef.current = inflight
    return inflight
  }, [])

  // Fetch daily tasks by filtering the shared payload
  const dailyTasksFetcher = useCallback(async () => {
    const tasks = await fetchAllOpenTasks()
    return tasks.filter(task => {
      const due = task?.due
      if (!due) return false
      if (typeof due.date === 'string') {
        return due.date.slice(0, 10) === dateStr
      }
      if (typeof due.datetime === 'string') {
        return due.datetime.slice(0, 10) === dateStr
      }
      return false
    })
  }, [fetchAllOpenTasks, dateStr])

  // Fetch all open tasks (reuses shared fetch)
  const allTasksFetcher = useCallback(async () => {
    const tasks = await fetchAllOpenTasks()
    const normalized = Array.isArray(tasks) ? [...tasks] : []
    normalized.sort((a: any, b: any) => {
      const posA = a.position ?? Number.MAX_SAFE_INTEGER
      const posB = b.position ?? Number.MAX_SAFE_INTEGER
      return posA - posB
    })
    return normalized
  }, [fetchAllOpenTasks])
  
  // Use data cache for both daily and all tasks
  const {
    data: dailyTasks,
    loading: dailyLoading,
    error: dailyError,
    updateOptimistically: updateDailyOptimistically,
    refetch: refetchDaily
  } = useDataCache<Task[]>(dailyCacheKey, dailyTasksFetcher, {
    ttl: 5 * 60 * 1000, // 5 minutes
    prefetch: false // Don't prefetch to avoid immediate errors on mount
  })
  
  const {
    data: allTasks,
    loading: allLoading,
    error: allError,
    updateOptimistically: updateAllOptimistically,
    refetch: refetchAll
  } = useDataCache<Task[]>(allCacheKey, allTasksFetcher, {
    ttl: 5 * 60 * 1000, // 5 minutes
    prefetch: false // Don't prefetch to avoid immediate errors on mount
  })

  const scheduleRefetch = useCallback((timestamp?: number, delayMs = 120) => {
    if (typeof timestamp === 'number') {
      if (timestamp <= lastSeenUpdateRef.current) return
      lastSeenUpdateRef.current = timestamp
    } else {
      lastSeenUpdateRef.current = Date.now()
    }

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }
    refreshTimerRef.current = setTimeout(() => {
      // Force a fresh read after writes so stale in-flight fetches don't clobber optimistic state.
      sharedFetchRef.current = null
      sharedResultRef.current = null
      try { refetchDaily() } catch {}
      try { refetchAll() } catch {}
      refreshTimerRef.current = null
    }, delayMs)
  }, [refetchDaily, refetchAll])
  
  // Optimistic task creation
  const createTask = useCallback(async (
    content: string,
    dueDate: string | null,
    hourSlot?: number | string | null,
    bucket?: string,
    repeat: RepeatOption = 'none',
    options?: {
      endDate?: string | null
      endHourSlot?: number | string | null
      allDay?: boolean | null
    }
  ) => {
    const trimmed = content.trim()
    if (!trimmed) {
      return;
    }
    const repeatRule = repeat !== 'none' ? repeat : undefined
    const { endDate: explicitEndDate, endHourSlot, allDay } = options ?? {}

    const normalizeHourSlot = (value?: number | string | null): string | undefined => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        const hh = Math.max(0, Math.min(23, value))
        if (hh === 0) return 'hour-12AM'
        if (hh < 12) return `hour-${hh}AM`
        if (hh === 12) return 'hour-12PM'
        return `hour-${hh - 12}PM`
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const trimmedValue = value.trim()
        return trimmedValue.startsWith('hour-') ? trimmedValue : `hour-${trimmedValue}`
      }
      return undefined
    }

    const normalizedHourSlot = normalizeHourSlot(hourSlot)
    const normalizedEndHourSlot = normalizeHourSlot(endHourSlot)
    const resolvedEndDate = explicitEndDate ?? dueDate
    const resolvedAllDay = typeof allDay === 'boolean'
      ? allDay
      : !normalizedHourSlot && !normalizedEndHourSlot

    // Helper: announce task update to other components
    const announceTaskUpdate = () => {
      if (typeof window !== 'undefined') {
        sharedFetchRef.current = null
        sharedResultRef.current = null
        const timestamp = Date.now()
        localUpdateTimestamps.current.add(timestamp)
        window.localStorage.setItem('lifeboard:last-tasks-update', timestamp.toString())
        window.dispatchEvent(new CustomEvent('lifeboard:tasks-updated', { detail: { timestamp } }))
      }
    }

    // Helper: add task to optimistic caches
    const addToOptimisticCaches = (task: Task) => {
      if (dueDate === dateStr) {
        updateDailyOptimistically(current => [...(current || []), task as any])
      }
      updateAllOptimistically(current => [...(current || []), task as any])
      announceTaskUpdate()
    }

    // Helper: create local task and persist to localStorage (last resort)
    const createLocalTask = (): any => {
      try {
        const generateUUID = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };
        const id = generateUUID()
        const task: Task = {
          id,
          content: trimmed,
          completed: false,
          due: dueDate ? { date: dueDate } : undefined,
          startDate: dueDate ?? undefined,
          endDate: resolvedEndDate ?? undefined,
          hourSlot: normalizedHourSlot,
          endHourSlot: normalizedEndHourSlot,
          bucket: bucket || undefined,
          position: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          repeatRule: repeatRule,
          allDay: resolvedAllDay,
          source: 'local'
        }
        if (typeof window !== 'undefined') {
          const raw = window.localStorage.getItem('lifeboard_local_tasks')
          const list: Task[] = raw ? JSON.parse(raw) : []
          list.unshift(task)
          window.localStorage.setItem('lifeboard_local_tasks', JSON.stringify(list))
        }
        return task
      } catch (e) {
        console.warn('Failed to create local task', e)
        return null
      }
    }

    // Supabase request body — used for primary write
    const supabaseBody = {
      content: trimmed,
      start_date: dueDate,
      end_date: resolvedEndDate,
      hourSlot: normalizedHourSlot,
      endHourSlot: normalizedEndHourSlot,
      bucket,
      repeat_rule: repeatRule,
      allDay: resolvedAllDay,
      duration: options && 'duration' in options ? (options as any).duration : undefined,
    }

    // ── Step 1: Always write to Supabase first ──
    try {
      const supaRes = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supabaseBody),
      })

      if (supaRes.ok) {
        const json = await supaRes.json()
        const task = ensureTaskSource(json.task as Task, 'supabase')
        addToOptimisticCaches(task)

        // ── Step 2: Also sync to Todoist if connected (best-effort, non-blocking) ──
        if (todoistConnectedRef.current !== false) {
          fetch('/api/integrations/todoist/tasks', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: trimmed,
              due_date: dueDate,
              start_date: dueDate,
              end_date: resolvedEndDate,
              hour_slot: normalizedHourSlot,
              end_hour_slot: normalizedEndHourSlot,
              bucket,
              repeat_rule: repeatRule,
              all_day: resolvedAllDay,
            }),
          }).then(res => {
            if (!res.ok) {
              if (res.status === 400 || res.status === 401) {
                setTodoistConnected(false)
              }
            } else {
              setTodoistConnected(true)
            }
          }).catch(() => {
            // Todoist sync failed silently — Supabase already has the task
          })
        }

        return task
      }

      // Supabase write failed — log and try Todoist as fallback
      const supaError = await supaRes.text().catch(() => '')
      console.warn('Supabase task creation failed:', supaRes.status, supaError)
    } catch (supaErr) {
      console.warn('Supabase task creation network error:', supaErr)
    }

    // ── Step 3: Supabase failed — try Todoist as fallback ──
    try {
      const res = await fetch('/api/integrations/todoist/tasks', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          due_date: dueDate,
          start_date: dueDate,
          end_date: resolvedEndDate,
          hour_slot: normalizedHourSlot,
          end_hour_slot: normalizedEndHourSlot,
          bucket,
          repeat_rule: repeatRule,
          all_day: resolvedAllDay,
        }),
      })

      if (res.ok) {
        setTodoistConnected(true)
        const responseData = await res.json()
        const { task } = responseData

        // Parse LIFEBOARD_META from Todoist description
        let metadata: {
          duration?: number; hourSlot?: string; bucket?: string; repeatRule?: RepeatRule
          startDate?: string | null; endDate?: string | null; endHourSlot?: string | null; allDay?: boolean
        } = {}
        let cleanContent: string = task.content
        try {
          if (task.description) {
            const metaMatch = task.description.match(/\[LIFEBOARD_META\](.*?)\[\/LIFEBOARD_META\]/)
            if (metaMatch) metadata = JSON.parse(metaMatch[1])
          }
          if (typeof task.content === 'string') {
            const contentMetaMatch = task.content.match(/^(.*?)\s*\[LIFEBOARD_META\].*?\[\/LIFEBOARD_META\]$/)
            if (contentMetaMatch) {
              cleanContent = contentMetaMatch[1].trim()
              if (Object.keys(metadata).length === 0) {
                const metaMatch2 = task.content.match(/\[LIFEBOARD_META\](.*?)\[\/LIFEBOARD_META\]/)
                if (metaMatch2) metadata = JSON.parse(metaMatch2[1])
              }
            }
          }
        } catch { /* ignore parse errors */ }

        const enhancedTask = {
          ...task, content: cleanContent,
          ...(metadata.duration !== undefined ? { duration: metadata.duration } : {}),
          ...(metadata.hourSlot !== undefined ? { hourSlot: metadata.hourSlot } : {}),
          ...(metadata.bucket !== undefined ? { bucket: metadata.bucket } : {}),
          ...(metadata.repeatRule !== undefined ? { repeatRule: metadata.repeatRule } : {}),
          ...(metadata.startDate !== undefined ? { startDate: metadata.startDate } : {}),
          ...(metadata.endDate !== undefined ? { endDate: metadata.endDate } : {}),
          ...(metadata.endHourSlot !== undefined ? { endHourSlot: metadata.endHourSlot } : {}),
          ...(metadata.allDay !== undefined ? { allDay: metadata.allDay } : {}),
        }
        const todoistTask = ensureTaskSource(enhancedTask as Task, 'todoist')
        addToOptimisticCaches(todoistTask)
        return todoistTask
      }

      if (res.status === 400 || res.status === 401) {
        setTodoistConnected(false)
      }
    } catch {
      // Todoist also failed
    }

    // ── Step 4: Both failed — local storage as last resort ──
    console.warn('Both Supabase and Todoist failed — creating local task')
    const local = createLocalTask()
    if (local) {
      addToOptimisticCaches(local)
      return local
    }
    throw new Error('Failed to create task: all persistence methods failed')
  }, [dateStr, updateDailyOptimistically, updateAllOptimistically])

  // On mount, check if another part of the app recently announced a task update
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem('lifeboard:last-tasks-update')
      if (stored) {
        const ts = Number(stored)
        if (!Number.isNaN(ts) && !localUpdateTimestamps.current.has(ts)) {
          scheduleRefetch(ts, 0)
        }
      }
    } catch {}
  }, [scheduleRefetch])

  // On mount, sync any orphaned local tasks to Supabase
  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncLocalTasks = async () => {
      try {
        const raw = window.localStorage.getItem('lifeboard_local_tasks')
        if (!raw) return
        const localTasks: Task[] = JSON.parse(raw)
        if (!Array.isArray(localTasks) || localTasks.length === 0) return

        const synced: string[] = []
        for (const task of localTasks) {
          if (task.completed) continue
          try {
            const res = await fetch('/api/tasks', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: task.content,
                start_date: task.startDate ?? task.due?.date,
                end_date: task.endDate,
                hourSlot: task.hourSlot,
                endHourSlot: task.endHourSlot,
                bucket: task.bucket,
                repeat_rule: task.repeatRule,
                allDay: task.allDay,
                duration: task.duration,
              }),
            })
            if (res.ok) {
              synced.push(task.id)
            }
          } catch {
            // Individual sync failure — skip this task, try others
          }
        }

        if (synced.length > 0) {
          // Remove synced tasks from local storage
          const remaining = localTasks.filter(t => !synced.includes(t.id))
          if (remaining.length === 0) {
            window.localStorage.removeItem('lifeboard_local_tasks')
          } else {
            window.localStorage.setItem('lifeboard_local_tasks', JSON.stringify(remaining))
          }
          // Refetch to include newly synced tasks
          sharedFetchRef.current = null
          sharedResultRef.current = null
          try { refetchDaily() } catch {}
          try { refetchAll() } catch {}
        }
      } catch {
        // Non-critical — will try again next mount
      }
    }
    syncLocalTasks()
  }, [refetchDaily, refetchAll])

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [])

  // React to global refresh events (e.g., chat-created tasks) and storage sync
  useEffect(() => {
    function onTasksUpdated(event: Event) {
      const custom = event as CustomEvent<{ timestamp?: number; nocache?: boolean }>
      const ts = typeof custom.detail?.timestamp === 'number' ? custom.detail?.timestamp : Date.now()
      // Skip refetch if this update originated from our own createTask/toggle — the optimistic state is already correct
      if (localUpdateTimestamps.current.has(ts)) {
        localUpdateTimestamps.current.delete(ts)
        return
      }
      // Chat-created tasks set nocache to bypass server-side Todoist cache (handles serverless isolation)
      if (custom.detail?.nocache) {
        nocacheRef.current = true
      }
      scheduleRefetch(ts)
    }

    function onStorage(event: StorageEvent) {
      if (event.key === 'lifeboard:last-tasks-update' && event.newValue) {
        const ts = Number(event.newValue)
        if (!Number.isNaN(ts)) {
          scheduleRefetch(ts)
        }
      }
    }

    // Optimistically inject a task created from chat (bypasses refetch entirely)
    function onTaskInjected(event: Event) {
      const custom = event as CustomEvent<{ task?: Task }>
      const task = custom.detail?.task
      if (!task || !task.id) return
      updateAllOptimistically((current) => {
        const list = current || []
        // Avoid duplicates
        if (list.some(t => t.id === task.id)) return list
        return [task, ...list]
      })
      updateDailyOptimistically((current) => {
        const list = current || []
        if (!task.due?.date) return list
        if (task.due.date.slice(0, 10) !== dateStr) return list
        if (list.some(t => t.id === task.id)) return list
        return [task, ...list]
      })
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('lifeboard:tasks-updated', onTasksUpdated)
      window.addEventListener('storage', onStorage)
      window.addEventListener('lifeboard:task-injected', onTaskInjected)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('lifeboard:tasks-updated', onTasksUpdated)
        window.removeEventListener('storage', onStorage)
        window.removeEventListener('lifeboard:task-injected', onTaskInjected)
      }
    }
  }, [scheduleRefetch, updateAllOptimistically, updateDailyOptimistically, dateStr])
  
  // Optimistic task toggle
  const toggleTaskCompletion = useCallback(async (taskId: string) => {
    const task = allTasks?.find(t => t.id?.toString?.() === taskId?.toString?.()) ||
                 dailyTasks?.find(t => t.id?.toString?.() === taskId?.toString?.())

    if (!task) return

    const source = (task.source ?? inferSourceFromId(task.id)) as 'todoist' | 'supabase' | 'local'
    const newCompleted = !task.completed

    const newKanbanStatus: KanbanStatus = newCompleted ? 'done' : 'todo'
    const updater = (tasks: Task[] | null) =>
      tasks?.map(t => t.id === taskId ? { ...t, completed: newCompleted, kanbanStatus: newKanbanStatus } : t) || []

    const revertOptimistic = () => {
      const oldKanbanStatus: KanbanStatus = !newCompleted ? 'done' : 'todo'
      const revertUpdater = (tasks: Task[] | null) =>
        tasks?.map(t => t.id === taskId ? { ...t, completed: !newCompleted, kanbanStatus: oldKanbanStatus } : t) || []
      updateDailyOptimistically(revertUpdater)
      updateAllOptimistically(revertUpdater)
    }

    const persistLocalToggle = () => {
      if (typeof window === 'undefined') return
      try {
        const raw = window.localStorage.getItem('lifeboard_local_tasks')
        const list: Task[] = raw ? JSON.parse(raw) : []
        const normalized = ensureTasksSource(list, 'local')
        const updated = normalized.map(t =>
          t.id?.toString?.() === taskId?.toString?.()
            ? { ...t, completed: newCompleted, updated_at: new Date().toISOString(), source: 'local' as const }
            : t
        )
        window.localStorage.setItem('lifeboard_local_tasks', JSON.stringify(updated))
      } catch {}
    }

    const toggleViaSupabase = async () => {
      const endpoint = newCompleted ? '/api/tasks/complete' : '/api/tasks/reopen'
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })
      if (!res.ok) throw new Error('Failed to toggle task (supabase)')
      if (source === 'local') {
        persistLocalToggle()
      }
    }

    const toggleViaTodoist = async () => {
      const endpoint = newCompleted
        ? '/api/integrations/todoist/tasks/complete'
        : '/api/integrations/todoist/tasks/reopen'

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })

      if (res.ok) return

      if (res.status === 400 || res.status === 401) {
        setTodoistConnected(false)
        await toggleViaSupabase()
        return
      }

      throw new Error('Failed to toggle task')
    }

    updateDailyOptimistically(updater)
    updateAllOptimistically(updater)

    const shouldUseSupabaseFirst = todoistConnectedRef.current === false || source !== 'todoist'

    try {
      if (shouldUseSupabaseFirst) {
        await toggleViaSupabase()
        return
      }

      await toggleViaTodoist()
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error(String(caught))
      const isNetwork = error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('Network'))

      if (!shouldUseSupabaseFirst && (todoistConnectedRef.current === false || isNetwork)) {
        try {
          await toggleViaSupabase()
          return
        } catch (supabaseError) {
          if ((source as string) === 'local') {
            persistLocalToggle()
            return
          }
          revertOptimistic()
          throw supabaseError
        }
      }

      if (shouldUseSupabaseFirst && (source as string) === 'local') {
        persistLocalToggle()
        return
      }

      revertOptimistic()
      throw error
    }
  }, [allTasks, dailyTasks, updateDailyOptimistically, updateAllOptimistically])
  
  // Batch update for drag and drop
  const batchUpdateTasks = useCallback(async (updates: { taskId: string; updates: Partial<Task>; occurrenceDate?: string }[]) => {
    if (!Array.isArray(updates) || updates.length === 0) return

    const taskCache = new Map<string, Task | undefined>()
    const resolveTask = (id: string): Task | undefined => {
      const lookup = id.toString()
      if (!lookup) return undefined
      if (!taskCache.has(lookup)) {
        const match = (dailyTasks || []).find(t => t.id?.toString?.() === lookup)
          || (allTasks || []).find(t => t.id?.toString?.() === lookup)
        taskCache.set(lookup, match)
      }
      return taskCache.get(lookup)
    }

    const hasOwn = (obj: Record<string, any>, key: string) => Object.prototype.hasOwnProperty.call(obj, key)
    const touchesScheduledFields = (patch: Partial<Task>) => {
      const raw = (patch ?? {}) as Record<string, any>
      return hasOwn(raw, 'hourSlot') ||
        hasOwn(raw, 'endHourSlot') ||
        hasOwn(raw, 'startDate') ||
        hasOwn(raw, 'endDate') ||
        hasOwn(raw, 'duration') ||
        hasOwn(raw, 'allDay')
    }

    const describeChange = (patch?: Record<string, any>) => {
      const raw = patch ?? {}
      const parts: string[] = []
      if (hasOwn(raw, 'startDate') || hasOwn(raw, 'endDate')) parts.push('dates')
      if (hasOwn(raw, 'hourSlot') || hasOwn(raw, 'endHourSlot')) parts.push('scheduled time')
      if (hasOwn(raw, 'allDay')) parts.push('all-day status')
      if (hasOwn(raw, 'duration')) parts.push('duration')
      if (parts.length === 0) return 'Update this repeating task'
      if (parts.length === 1) return `Update the ${parts[0]} for this repeating task`
      if (parts.length === 2) return `Update the ${parts[0]} and ${parts[1]} for this repeating task`
      const last = parts[parts.length - 1]
      const initial = parts.slice(0, -1).join(', ')
      return `Update the ${initial}, and ${last} for this repeating task`
    }

    const resolveOccurrenceDate = (update: { updates: Partial<Task>; occurrenceDate?: string }, fallbackTask?: Task): string => {
      const raw = (update.updates ?? {}) as Record<string, any>
      const explicit = typeof update.occurrenceDate === 'string' ? update.occurrenceDate : undefined
      const fromPatch = typeof raw.occurrenceDate === 'string' ? raw.occurrenceDate : undefined
      const fromDue = raw.due && typeof raw.due === 'object' && typeof (raw.due as any)?.date === 'string'
        ? (raw.due as any).date as string
        : undefined
      const fromStartDate = typeof raw.startDate === 'string' ? raw.startDate : undefined

      const candidate = explicit || fromPatch || fromDue || fromStartDate
      if (candidate) return candidate

      const fallbackRule = fallbackTask?.repeatRule as RepeatOption | undefined
      if (fallbackRule && fallbackRule !== 'none') {
        return dateStr
      }

      return fallbackTask?.startDate ?? fallbackTask?.due?.date ?? dateStr
    }

    const repeatingTimeUpdates = updates
      .map(update => {
        const task = resolveTask(update.taskId)
        const taskRule = task?.repeatRule as RepeatOption | undefined
        if (!task || !taskRule || taskRule === 'none') return null
        if (!touchesScheduledFields(update.updates)) return null
        return { task, original: update }
      })
      .filter(Boolean) as { task: Task; original: { taskId: string; updates: Partial<Task>; occurrenceDate?: string } }[]

    let decision: OccurrenceDecision = 'all'
    if (repeatingTimeUpdates.length > 0) {
      const firstPatch = repeatingTimeUpdates[0].original.updates as Record<string, any> | undefined
      decision = await promptOccurrenceDecision({
        actionDescription: describeChange(firstPatch),
        taskTitle: repeatingTimeUpdates[0].task.content
      })
      if (decision === 'cancel') return
    }

    const updatesForAll: { taskId: string; updates: Partial<Task> }[] = []
    const singleOccurrenceUpdates: { task: Task; updates: Partial<Task>; occurrenceDate: string }[] = []

    updates.forEach(update => {
      const task = resolveTask(update.taskId)
      const taskRule = task?.repeatRule as RepeatOption | undefined
      if (!task || !taskRule || taskRule === 'none') {
        updatesForAll.push(update)
        return
      }
      if (decision === 'single' && touchesScheduledFields(update.updates)) {
        const occurrenceDate = resolveOccurrenceDate(update, task)
        singleOccurrenceUpdates.push({ task, updates: update.updates, occurrenceDate })
        return
      }
      updatesForAll.push(update)
    })

    if (decision === 'single' && singleOccurrenceUpdates.length > 0) {
      for (const entry of singleOccurrenceUpdates) {
        const raw = (entry.updates ?? {}) as Record<string, any>
        const payload: TaskOccurrenceExceptionUpsertInput = {
          taskId: entry.task.id,
          occurrenceDate: entry.occurrenceDate,
          skip: false
        }
        if (hasOwn(raw, 'hourSlot')) payload.overrideHourSlot = raw.hourSlot ?? null
        if (hasOwn(raw, 'duration')) payload.overrideDuration = raw.duration ?? null
        if (hasOwn(raw, 'bucket')) payload.overrideBucket = raw.bucket ?? null
        try {
          await upsertOccurrenceException(payload)
        } catch (error) {
          if (typeof window !== 'undefined') {
            window.alert('Failed to update just this occurrence. Please try again.')
          }
          return
        }
      }
    }

    if (updatesForAll.length === 0) {
      return
    }

    const mergeTasks = (current: Task[] | null, pending: { taskId: string; updates: Partial<Task> }[], { constrainToDate }: { constrainToDate?: boolean } = {}) => {
      const map = new Map<string, Task>()
      ;(current || []).forEach(task => {
        map.set(task.id?.toString?.() ?? '', task)
      })

      pending.forEach(({ taskId, updates: partial }) => {
        const key = taskId?.toString?.() ?? ''
        if (!key) return
        const original = map.get(key) ?? resolveTask(key)
        const merged: Task = {
          id: original?.id ?? key,
          content: partial.content ?? original?.content ?? '',
          completed: partial.completed ?? original?.completed ?? false,
          ...original,
          ...partial,
        }
        map.set(key, merged)
      })

      let next = Array.from(map.values())
      if (constrainToDate) {
        next = next.filter(task => task.due?.date === dateStr)
      }
      return next
    }

    updateDailyOptimistically(tasks => mergeTasks(tasks, updatesForAll, { constrainToDate: true }))
    updateAllOptimistically(tasks => mergeTasks(tasks, updatesForAll))

    // Separate updates by task source (Supabase vs Todoist)
    // Local tasks are routed to Supabase since that's the primary database
    const supabaseUpdates = updatesForAll.filter(update => {
      const task = resolveTask(update.taskId);
      const source = task?.source || inferSourceFromId(update.taskId);
      return source === 'supabase' || source === 'local';
    });

    const todoistUpdates = updatesForAll.filter(update => {
      const task = resolveTask(update.taskId);
      const source = task?.source || inferSourceFromId(update.taskId);
      return source === 'todoist';
    });

    // Send batch update to server (soft-fail if API unreachable)
    try {
      // Update Supabase tasks
      if (supabaseUpdates.length > 0) {
        const res = await fetch('/api/tasks/batch-update', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: supabaseUpdates })
        })
        if (!res.ok) console.warn('Supabase batch update failed')
      }
      
      // Update Todoist tasks
      if (todoistUpdates.length === 0) {
        return;
      }
      
      const res = await fetch('/api/integrations/todoist/tasks/batch-update', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: todoistUpdates })
      })
      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        console.warn('❌ Batch update non-OK:', res.status, errorText)
        refetchDaily()
        refetchAll()
        return
      }
      const result = await res.json().catch(() => null)
    } catch (error) {
      console.warn('💥 Batch update network error (continuing with optimistic state):', error)
      try {
        await fetch('/api/tasks/batch-update', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: updatesForAll })
        })
      } catch {}
      refetchDaily()
      refetchAll()
      return
    }
  }, [updateDailyOptimistically, updateAllOptimistically, refetchDaily, refetchAll, allTasks, dailyTasks, dateStr, promptOccurrenceDecision, upsertOccurrenceException])
  
  // Optimistic task deletion
  const findTaskById = useCallback((taskId: string): Task | undefined => {
    const lookup = taskId?.toString?.() ?? ''
    if (!lookup) return undefined
    return (dailyTasks || []).find(t => t.id?.toString?.() === lookup)
      || (allTasks || []).find(t => t.id?.toString?.() === lookup)
  }, [dailyTasks, allTasks])

  const resolveTaskSource = useCallback((taskId: string): Task['source'] => {
    const lookup = taskId?.toString?.() ?? ''
    if (!lookup) return 'supabase'
    const match = findTaskById(taskId)
    if (match) {
      return ensureTaskSource(match).source ?? inferSourceFromId(match.id)
    }
    return inferSourceFromId(lookup)
  }, [findTaskById])

  const deleteTask = useCallback(async (taskId: string, occurrenceDateInput?: string) => {
    const task = findTaskById(taskId)
    let decision: OccurrenceDecision = 'all'

    if (!task) {
      return
    }

    const taskRepeatRule = task?.repeatRule as RepeatOption | undefined
    if (taskRepeatRule && taskRepeatRule !== 'none') {
      decision = await promptOccurrenceDecision({
        actionDescription: 'Delete this repeating task',
        taskTitle: task.content
      })
      if (decision === 'cancel') {
        return
      }
      if (decision === 'single') {
        const occurrenceDate = occurrenceDateInput || task.due?.date || dateStr
        try {
          await upsertOccurrenceException({
            taskId,
            occurrenceDate,
            skip: true
          })
        } catch (error) {
          if (typeof window !== 'undefined') {
            window.alert('Failed to skip this occurrence. Please try again.')
          }
        }
        return
      }
    }

    // Update optimistically by removing the task when deleting the full series
    const updater = (tasks: Task[] | null) => 
      tasks?.filter(t => t.id.toString() !== taskId) || []
    
    updateDailyOptimistically(updater)
    updateAllOptimistically(updater)

    const source = resolveTaskSource(taskId)

    const deleteViaSupabase = async () => {
      const res = await fetch('/api/tasks/delete', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })
      if (!res.ok) throw new Error('Failed to delete task (supabase)')
    }

    const preferSupabase = todoistConnectedRef.current === false || source !== 'todoist'
    
    try {
      if (preferSupabase) {
        await deleteViaSupabase()
        return
      }

      const res = await fetch('/api/integrations/todoist/tasks/delete', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })

      if (!res.ok) {
        if (res.status === 400 || res.status === 401) {
          setTodoistConnected(false)
          await deleteViaSupabase()
          return
        }

        if (res.status === 404) {
          // Task already gone in Todoist; refetch to keep state honest and exit early
          await Promise.all([refetchDaily(), refetchAll()])
          return
        }

        throw new Error('Failed to delete task')
      }
    } catch (error) {
      // On error, if offline/not connected, try Supabase or keep optimistic
      const isNetwork = error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('Network'))
      if (preferSupabase || todoistConnectedRef.current === false || isNetwork) {
        try {
          await deleteViaSupabase()
          return
        } catch {}
        return
      }
      // Otherwise refetch to correct state
      refetchDaily()
      refetchAll()
      throw error
    }
  }, [findTaskById, promptOccurrenceDecision, upsertOccurrenceException, dateStr, updateDailyOptimistically, updateAllOptimistically, refetchDaily, refetchAll, resolveTaskSource])
  
  // Filter tasks for different views
  const dailyVisibleTasks = useMemo(() =>
    (dailyTasks || []).filter(t => {
      if (t.completed || t.hourSlot) return false
      const perTask = occurrenceExceptionIndex.get(t.id)
      if (perTask?.get(dateStr)?.skip) return false
      return true
    }),
    [dailyTasks, occurrenceExceptionIndex, dateStr]
  );

  const completedTasks = useMemo(() =>
    (allTasks || []).filter(t => t.completed),
    [allTasks]
  );

  const scheduledTasks = useMemo(() => {
    const targetDateStr = dateStr

    const occursOnDate = (task: Task, todayStr: string) => {
      if (!task || task.completed) return false
      const dueDateStr = task.due?.date
      if (!dueDateStr) {
        return true
      }

      const rule = task.repeatRule as string | undefined
      if (!rule || rule === 'none') {
        return dueDateStr === todayStr
      }

      const target = new Date(`${todayStr}T00:00:00`)
      const due = new Date(`${dueDateStr}T00:00:00`)
      if (target < due) return false

      const day = target.getDay()
      const dueDay = due.getDay()
      const diffDays = Math.floor((target.getTime() - due.getTime()) / (24 * 60 * 60 * 1000))

      switch (rule) {
        case 'daily':
          return true
        case 'weekdays':
          return day >= 1 && day <= 5
        case 'weekly':
          return diffDays % 7 === 0 && day === dueDay
        case 'monthly': {
          const dueDateNum = due.getDate()
          const targetDateNum = target.getDate()
          const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
          if (dueDateNum > daysInTargetMonth) {
            return targetDateNum === daysInTargetMonth
          }
          return targetDateNum === dueDateNum
        }
        default:
          return false
      }
    }

    const collectFrom = (source: Task[] | null | undefined, map: Map<string, Task>) => {
      (source || []).forEach(originalTask => {
        const task = originalTask as Task
        if (!occursOnDate(task, targetDateStr)) return
        const adjusted = applyOccurrenceAdjustments(task, targetDateStr)
        if (!adjusted || !adjusted.hourSlot) return
        map.set(adjusted.id, adjusted)
      })
    }

    const taskMap = new Map<string, Task>()
    collectFrom(dailyTasks, taskMap)
    collectFrom(allTasks, taskMap)

    return Array.from(taskMap.values())
  }, [dailyTasks, allTasks, dateStr, applyOccurrenceAdjustments])

  // Upcoming tasks: all open tasks with future due dates
  const upcomingTasks = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    return (allTasks || []).filter(t => {
      if (t.completed) return false;
      if (!t.due?.date) return false;
      return t.due.date > todayStr;
    }).sort((a, b) => {
      // Sort by due date ascending
      if (!a.due?.date || !b.due?.date) return 0;
      return a.due.date.localeCompare(b.due.date);
    });
  }, [allTasks]);

  return {
    dailyTasks: dailyTasks || [],
    allTasks: allTasks || [],
    dailyVisibleTasks, // Tasks that should appear in daily list (no hourSlot)
    scheduledTasks,    // Tasks that should appear in hourly planner (has hourSlot)
    upcomingTasks,     // Tasks with future due dates
    completedTasks,    // All completed tasks
    getTaskForOccurrence,
    loading: dailyLoading || allLoading,
    error: dailyError || allError,
    createTask,
    toggleTaskCompletion,
    batchUpdateTasks,
    deleteTask,
    refetch: () => {
      refetchDaily()
      refetchAll()
    }
  }
}
