import { useCallback, useEffect, useRef } from 'react'
import { useDataCache } from './use-data-cache'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import {
  ensureTaskSource,
  ensureTasksSource,
  isAbortLikeError,
  isNetworkFetchError,
} from './task-helpers'
import type { TaskSharedState } from './task-helpers'
import type { Task } from '@/types/tasks'

const SHARED_RESULT_TTL = 30_000

export function useTaskFetcher(dateStr: string, shared: TaskSharedState) {
  const {
    sharedFetchRef,
    sharedResultRef,
    todoistConnectedRef,
    setTodoistConnected,
    localUpdateTimestamps,
    nocacheRef,
  } = shared

  const lastSeenUpdateRef = useRef<number>(0)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dailyCacheKey = `tasks-daily-${dateStr}`
  const allCacheKey = 'tasks-all-open'

  const fetchAllOpenTasks = useCallback(async (): Promise<Task[]> => {
    if (sharedFetchRef.current) {
      return sharedFetchRef.current
    }

    // Return recently resolved result to prevent duplicate fetches
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

        // Fire Todoist and Supabase fetches in PARALLEL
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
          // Supabase fetch runs in parallel
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
  }, [sharedFetchRef, sharedResultRef, todoistConnectedRef, setTodoistConnected, nocacheRef])

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
    ttl: 5 * 60 * 1000,
    prefetch: false
  })

  const {
    data: allTasks,
    loading: allLoading,
    error: allError,
    updateOptimistically: updateAllOptimistically,
    refetch: refetchAll
  } = useDataCache<Task[]>(allCacheKey, allTasksFetcher, {
    ttl: 5 * 60 * 1000,
    prefetch: false
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
      // Force a fresh read after writes
      sharedFetchRef.current = null
      sharedResultRef.current = null
      try { refetchDaily() } catch {}
      try { refetchAll() } catch {}
      refreshTimerRef.current = null
    }, delayMs)
  }, [refetchDaily, refetchAll, sharedFetchRef, sharedResultRef])

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
  }, [scheduleRefetch, localUpdateTimestamps])

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
          const remaining = localTasks.filter(t => !synced.includes(t.id))
          if (remaining.length === 0) {
            window.localStorage.removeItem('lifeboard_local_tasks')
          } else {
            window.localStorage.setItem('lifeboard_local_tasks', JSON.stringify(remaining))
          }
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
  }, [refetchDaily, refetchAll, sharedFetchRef, sharedResultRef])

  // Cleanup refresh timer on unmount
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
      // Skip refetch if this update originated from our own createTask/toggle
      if (localUpdateTimestamps.current.has(ts)) {
        localUpdateTimestamps.current.delete(ts)
        return
      }
      // Chat-created tasks set nocache to bypass server-side Todoist cache
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

    // Optimistically inject a task created from chat
    function onTaskInjected(event: Event) {
      const custom = event as CustomEvent<{ task?: Task }>
      const task = custom.detail?.task
      if (!task || !task.id) return
      updateAllOptimistically((current) => {
        const list = current || []
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
  }, [scheduleRefetch, updateAllOptimistically, updateDailyOptimistically, dateStr, localUpdateTimestamps, nocacheRef])

  // Wrap refetch functions to clear the shared result cache first.
  // Without this, fetchAllOpenTasks returns stale data from sharedResultRef
  // (30s TTL) which overwrites optimistic updates after mutations like delete.
  const forceRefetchDaily = useCallback(() => {
    sharedFetchRef.current = null
    sharedResultRef.current = null
    refetchDaily()
  }, [refetchDaily, sharedFetchRef, sharedResultRef])

  const forceRefetchAll = useCallback(() => {
    sharedFetchRef.current = null
    sharedResultRef.current = null
    refetchAll()
  }, [refetchAll, sharedFetchRef, sharedResultRef])

  return {
    dailyTasks,
    allTasks,
    dailyLoading,
    allLoading,
    dailyError,
    allError,
    updateDailyOptimistically,
    updateAllOptimistically,
    refetchDaily: forceRefetchDaily,
    refetchAll: forceRefetchAll,
    scheduleRefetch,
  }
}
