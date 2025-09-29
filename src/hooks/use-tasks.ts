import { useCallback, useMemo, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { OccurrenceDecision, useOccurrencePrompt } from '@/contexts/tasks-occurrence-prompt-context'
import { useDataCache } from './use-data-cache'

export type RepeatRule = 'daily' | 'weekly' | 'weekdays' | 'monthly'
export type RepeatOption = RepeatRule | 'none'

export interface TaskDue {
  date?: string
  datetime?: string
  string?: string
  is_recurring?: boolean
}

export interface Task {
  id: string
  content: string
  completed: boolean
  due?: TaskDue | null
  duration?: number
  hourSlot?: string
  bucket?: string
  position?: number
  created_at?: string
  updated_at?: string
  repeatRule?: RepeatRule
  source?: 'todoist' | 'supabase' | 'local'
}

export interface TaskOccurrenceException {
  id: string
  taskId: string
  occurrenceDate: string
  skip: boolean
  overrideHourSlot?: string | null
  overrideDuration?: number | null
  overrideBucket?: string | null
  createdAt?: string
  updatedAt?: string
}

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

interface TaskUpdate {
  taskId: string
  updates: Partial<Task>
}

// Custom hook for managing tasks with optimistic updates
export function useTasks(selectedDate?: Date) {
  // Track whether Todoist is connected in this session; null = unknown
  const todoistConnectedRef = useRef<boolean | null>(null)
  const lastSeenUpdateRef = useRef<number>(0)
  const sharedFetchRef = useRef<Promise<Task[]> | null>(null)
  const promptOccurrenceDecision = useOccurrencePrompt()
  const [occurrenceExceptions, setOccurrenceExceptions] = useState<TaskOccurrenceException[]>([])

  const refreshOccurrenceExceptions = useCallback(async () => {
    if (typeof window === 'undefined') return
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
      setOccurrenceExceptions(list)
    } catch (error) {
      console.warn('Failed to refresh task occurrence exceptions', error)
    }
  }, [])

  useEffect(() => {
    refreshOccurrenceExceptions()
  }, [refreshOccurrenceExceptions])

  const upsertOccurrenceException = useCallback(async (input: {
    taskId: string
    occurrenceDate: string
    skip?: boolean
    overrideHourSlot?: string | null
    overrideDuration?: number | null
    overrideBucket?: string | null
  }) => {
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

    const inflight = (async () => {
      try {
        // If we already know Todoist is not connected, skip trying it
        if (todoistConnectedRef.current === false) {
          const supa = await fetch('/api/tasks?all=true', { credentials: 'same-origin' })
          if (supa.ok) {
            const json = await supa.json()
            const supabaseTasks = Array.isArray(json) ? json : (json.tasks ?? [])
            return ensureTasksSource(supabaseTasks as Task[], 'supabase')
          }
          // If Supabase also fails, try localStorage
          if (typeof window !== 'undefined') {
            const raw = window.localStorage.getItem('lifeboard_local_tasks')
            const list: Task[] = raw ? JSON.parse(raw) : []
            const normalized = ensureTasksSource(list, 'local')
            return normalized.filter(t => !t.completed)
          }
          return []
        }

        const res = await fetch('/api/integrations/todoist/tasks?all=true', {
          credentials: 'same-origin'
        })
        if (!res.ok) {
          if (res.status === 400 || res.status === 401) {
            todoistConnectedRef.current = false
            const supa = await fetch('/api/tasks?all=true', { credentials: 'same-origin' })
            if (supa.ok) {
              const json = await supa.json()
              const supabaseTasks = Array.isArray(json) ? json : (json.tasks ?? [])
              return ensureTasksSource(supabaseTasks as Task[], 'supabase')
            }
            return []
          }
          if (res.status >= 500 || res.status === 429) {
            console.warn(`Upstream error fetching tasks: ${res.status} (treat as empty to avoid UI crash)`)
            return []
          }
          throw new Error(`Failed to fetch tasks: ${res.status}`)
        }
        const todoistData = await res.json()
        todoistConnectedRef.current = true
        const todoistRaw: Task[] = Array.isArray(todoistData) ? todoistData : (todoistData.tasks ?? [])
        const todoistTasks = ensureTasksSource(todoistRaw, 'todoist')

        // When Todoist is connected, also fetch Supabase tasks and merge them
        let supabaseTasks: Task[] = []
        try {
          const supa = await fetch('/api/tasks?all=true', { credentials: 'same-origin' })
          if (supa.ok) {
            const json = await supa.json()
            const supabaseRaw = Array.isArray(json) ? json : (json.tasks ?? [])
            supabaseTasks = ensureTasksSource(supabaseRaw as Task[], 'supabase')
          }
        } catch (error) {
          console.warn('Failed to fetch Supabase tasks while connected to Todoist:', error)
        }
        
        // Merge Todoist and Supabase tasks, with Todoist taking precedence for duplicates
        const taskMap = new Map<string, Task>()
        
        // Add Supabase tasks first
        supabaseTasks.forEach((task: Task) => {
          taskMap.set(task.id, task)
        })
        
        // Add Todoist tasks (will overwrite any duplicates)
        todoistTasks.forEach((task: Task) => {
          taskMap.set(task.id, task)
        })
        
        return Array.from(taskMap.values())
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          todoistConnectedRef.current = false
          try {
            const supa = await fetch('/api/tasks?all=true', { credentials: 'same-origin' })
            if (supa.ok) {
              const json = await supa.json()
              const supabaseTasks = Array.isArray(json) ? json : (json.tasks ?? [])
              return ensureTasksSource(supabaseTasks as Task[], 'supabase')
            }
          } catch {}
          try {
            if (typeof window !== 'undefined') {
              const raw = window.localStorage.getItem('lifeboard_local_tasks')
              const list: Task[] = raw ? JSON.parse(raw) : []
              const normalized = ensureTasksSource(list, 'local')
              return normalized.filter(t => !t.completed)
            }
          } catch {}
          return []
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
    ttl: 2 * 60 * 1000, // 2 minutes - shorter cache for Master List
    prefetch: false // Don't prefetch to avoid immediate errors on mount
  })
  
  // Optimistic task creation
  const createTask = useCallback(async (
    content: string,
    dueDate: string | null,
    hourSlot?: number,
    bucket?: string,
    repeat: RepeatOption = 'none'
  ) => {
    console.log('🔧 createTask hook called:', { content, dueDate, hourSlot, bucket, repeat });
    
    const trimmed = content.trim()
    if (!trimmed) {
      console.log('❌ createTask: Empty content, returning early');
      return;
    }
    const repeatRule = repeat !== 'none' ? repeat : undefined
    
    // Helper: create local task and persist to localStorage
    const createLocalTask = (): any => {
      try {
        // Generate a proper UUID for local tasks to be compatible with Supabase
        const generateUUID = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };
        const id = generateUUID()
        const toHourSlot = (h?: number) => {
          if (typeof h !== 'number') return undefined
          const hh = Math.max(0, Math.min(23, h))
          if (hh === 0) return 'hour-12AM'
          if (hh < 12) return `hour-${hh}AM`
          if (hh === 12) return 'hour-12PM'
          return `hour-${hh - 12}PM`
        }
        const task: Task = {
          id,
          content: trimmed,
          completed: false,
          due: dueDate ? { date: dueDate } : undefined,
          hourSlot: toHourSlot(hourSlot),
          bucket: bucket || undefined,
          position: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          repeatRule: repeatRule,
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

    try {
      console.log('📡 Making API request to create task...');
      const res = await fetch('/api/integrations/todoist/tasks', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, due_date: dueDate, hour_slot: hourSlot, bucket, repeat_rule: repeatRule }),
      })
      
      console.log('📡 API response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error('❌ API request failed:', { status: res.status, statusText: res.statusText, errorText });
        // If Todoist not connected or auth missing, use Supabase fallback
        if (res.status === 400 || res.status === 401) {
          todoistConnectedRef.current = false
          const alt = await fetch('/api/tasks', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, due_date: dueDate, hour_slot: hourSlot, bucket, repeat_rule: repeatRule })
          })
          if (alt.ok) {
            const json = await alt.json()
            const task = ensureTaskSource(json.task as Task, 'supabase')
            if (dueDate === dateStr) {
              updateDailyOptimistically(current => [...(current || []), task as any])
            }
            updateAllOptimistically(current => [...(current || []), task as any])
            // Announce the task update to other components
            if (typeof window !== 'undefined') {
              const timestamp = Date.now()
              window.localStorage.setItem('lifeboard:last-tasks-update', timestamp.toString())
              window.dispatchEvent(new CustomEvent('lifeboard:tasks-updated', { detail: { timestamp } }))
            }
            return task
          }
          // As last resort create local
          const local = createLocalTask()
          if (local) {
            if (dueDate === dateStr) updateDailyOptimistically(current => [...(current || []), local as any])
            updateAllOptimistically(current => [...(current || []), local as any])
            // Announce the task update to other components
            if (typeof window !== 'undefined') {
              const timestamp = Date.now()
              window.localStorage.setItem('lifeboard:last-tasks-update', timestamp.toString())
              window.dispatchEvent(new CustomEvent('lifeboard:tasks-updated', { detail: { timestamp } }))
            }
            return local
          }
        }
        throw new Error(`Failed to create task: ${res.status} ${res.statusText}`);
      }
      
      const responseData = await res.json();
      console.log('📦 API response data:', responseData);
      const { task } = responseData;

      // Parse and normalize metadata so UI shows bucket/duration immediately
      let metadata: { duration?: number; hourSlot?: string; bucket?: string; repeatRule?: RepeatRule } = {}
      let cleanContent: string = task.content

      try {
        if (task.description) {
          const metaMatch = task.description.match(/\[LIFEBOARD_META\](.*?)\[\/LIFEBOARD_META\]/)
          if (metaMatch) {
            metadata = JSON.parse(metaMatch[1])
          }
        }
        if (typeof task.content === 'string') {
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
        }
      } catch {
        // Ignore parse errors; fall back to raw task fields
      }

      const enhancedTask = {
        ...task,
        content: cleanContent,
        ...(metadata.duration !== undefined ? { duration: metadata.duration } : {}),
        ...(metadata.hourSlot !== undefined ? { hourSlot: metadata.hourSlot } : {}),
        ...(metadata.bucket !== undefined ? { bucket: metadata.bucket } : {}),
        ...(metadata.repeatRule !== undefined ? { repeatRule: metadata.repeatRule } : {}),
      }

      const todoistTask = ensureTaskSource(enhancedTask as Task, 'todoist')

      // Add task to appropriate caches
      if (dueDate === dateStr) {
        console.log('📅 Adding task to daily cache for date:', dateStr);
        updateDailyOptimistically(current => [...(current || []), todoistTask as any])
      }
      console.log('📋 Adding task to all tasks cache');
      updateAllOptimistically(current => [...(current || []), todoistTask as any])
      
      // Announce the task update to other components
      if (typeof window !== 'undefined') {
        const timestamp = Date.now()
        window.localStorage.setItem('lifeboard:last-tasks-update', timestamp.toString())
        window.dispatchEvent(new CustomEvent('lifeboard:tasks-updated', { detail: { timestamp } }))
      }
      
      console.log('✅ createTask returning task:', todoistTask);
      return todoistTask
    } catch (error) {
      console.error('💥 createTask error:', error);
      // Network or other errors – try Supabase, then local
      try {
        const alt = await fetch('/api/tasks', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, due_date: dueDate, hour_slot: hourSlot, bucket, repeat_rule: repeatRule })
        })
        if (alt.ok) {
          const json = await alt.json()
          const task = ensureTaskSource(json.task as Task, 'supabase')
          if (dueDate === dateStr) updateDailyOptimistically(current => [...(current || []), task as any])
          updateAllOptimistically(current => [...(current || []), task as any])
          // Announce the task update to other components
          if (typeof window !== 'undefined') {
            const timestamp = Date.now()
            window.localStorage.setItem('lifeboard:last-tasks-update', timestamp.toString())
            window.dispatchEvent(new CustomEvent('lifeboard:tasks-updated', { detail: { timestamp } }))
          }
          return task
        }
      } catch {}
      const local = createLocalTask()
      if (local) {
        if (dueDate === dateStr) updateDailyOptimistically(current => [...(current || []), local as any])
        updateAllOptimistically(current => [...(current || []), local as any])
        // Announce the task update to other components
        if (typeof window !== 'undefined') {
          const timestamp = Date.now()
          window.localStorage.setItem('lifeboard:last-tasks-update', timestamp.toString())
          window.dispatchEvent(new CustomEvent('lifeboard:tasks-updated', { detail: { timestamp } }))
        }
        return local
      }
      throw error
    }
  }, [dateStr, updateDailyOptimistically, updateAllOptimistically])

  // On mount, check if another part of the app recently announced a task update
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem('lifeboard:last-tasks-update')
      if (stored) {
        const ts = Number(stored)
        if (!Number.isNaN(ts) && ts > lastSeenUpdateRef.current) {
          lastSeenUpdateRef.current = ts
          try { refetchDaily() } catch {}
          try { refetchAll() } catch {}
        }
      }
    } catch {}
  }, [refetchDaily, refetchAll])

  // React to global refresh events (e.g., chat-created tasks) and storage sync
  useEffect(() => {
    function triggerRefresh(ts?: number) {
      if (typeof ts === 'number') {
        if (ts <= lastSeenUpdateRef.current) {
          return
        }
        lastSeenUpdateRef.current = ts
      } else {
        lastSeenUpdateRef.current = Date.now()
      }
      try { refetchDaily() } catch {}
      try { refetchAll() } catch {}
    }

    function onTasksUpdated(event: Event) {
      const custom = event as CustomEvent<{ timestamp?: number }>
      const ts = typeof custom.detail?.timestamp === 'number' ? custom.detail?.timestamp : Date.now()
      triggerRefresh(ts)
    }

    function onStorage(event: StorageEvent) {
      if (event.key === 'lifeboard:last-tasks-update' && event.newValue) {
        const ts = Number(event.newValue)
        if (!Number.isNaN(ts)) {
          triggerRefresh(ts)
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('lifeboard:tasks-updated', onTasksUpdated)
      window.addEventListener('storage', onStorage)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('lifeboard:tasks-updated', onTasksUpdated)
        window.removeEventListener('storage', onStorage)
      }
    }
  }, [refetchDaily, refetchAll])
  
  // Optimistic task toggle
  const toggleTaskCompletion = useCallback(async (taskId: string) => {
    const task = allTasks?.find(t => t.id?.toString?.() === taskId?.toString?.()) ||
                 dailyTasks?.find(t => t.id?.toString?.() === taskId?.toString?.())

    if (!task) return

    const source = (task.source ?? inferSourceFromId(task.id)) as 'todoist' | 'supabase' | 'local'
    const newCompleted = !task.completed

    const updater = (tasks: Task[] | null) =>
      tasks?.map(t => t.id === taskId ? { ...t, completed: newCompleted } : t) || []

    const revertOptimistic = () => {
      const revertUpdater = (tasks: Task[] | null) =>
        tasks?.map(t => t.id === taskId ? { ...t, completed: !newCompleted } : t) || []
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
        todoistConnectedRef.current = false
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
    console.log('🚀 batchUpdateTasks called with:', updates)

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
      return hasOwn(raw, 'hourSlot') || hasOwn(raw, 'duration')
    }

    const describeChange = (patch?: Record<string, any>) => {
      const raw = patch ?? {}
      const parts: string[] = []
      if (hasOwn(raw, 'hourSlot')) parts.push('scheduled time')
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

      const candidate = explicit || fromPatch || fromDue
      if (candidate) return candidate

      const fallbackRule = fallbackTask?.repeatRule as RepeatOption | undefined
      if (fallbackRule && fallbackRule !== 'none') {
        return dateStr
      }

      return fallbackTask?.due?.date ?? dateStr
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
      if (!task || !task.repeatRule || task.repeatRule === 'none') {
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
        const payload: Record<string, any> = {
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

    // Send batch update to server (soft-fail if API unreachable)
    try {
      if (todoistConnectedRef.current === false) {
        const res = await fetch('/api/tasks/batch-update', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: updatesForAll })
        })
        if (!res.ok) console.warn('Supabase batch update failed')
        return
      }
      console.log('📡 Sending batch update to API...')
      const res = await fetch('/api/integrations/todoist/tasks/batch-update', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: updatesForAll })
      })
      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        console.warn('❌ Batch update non-OK:', res.status, errorText)
        refetchDaily()
        refetchAll()
        return
      }
      const result = await res.json().catch(() => null)
      console.log('✅ Batch update successful:', result)
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
        const occurrenceDate = occurrenceDateInput || task?.due?.date || dateStr
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
          todoistConnectedRef.current = false
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

      if (!task.repeatRule) {
        return dueDateStr === todayStr
      }

      const target = new Date(`${todayStr}T00:00:00`)
      const due = new Date(`${dueDateStr}T00:00:00`)
      if (target < due) return false

      const day = target.getDay()
      const dueDay = due.getDay()
      const diffDays = Math.floor((target.getTime() - due.getTime()) / (24 * 60 * 60 * 1000))

      switch (task.repeatRule) {
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
