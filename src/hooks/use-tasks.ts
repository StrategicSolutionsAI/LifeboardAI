import { useCallback, useMemo, useEffect, useRef } from 'react'
import { format } from 'date-fns'
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

    const source = task.source ?? inferSourceFromId(task.id)
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
          if (source === 'local') {
            persistLocalToggle()
            return
          }
          revertOptimistic()
          throw supabaseError
        }
      }

      if (shouldUseSupabaseFirst && source === 'local') {
        persistLocalToggle()
        return
      }

      revertOptimistic()
      throw error
    }
  }, [allTasks, dailyTasks, updateDailyOptimistically, updateAllOptimistically])
  
  // Batch update for drag and drop
  const batchUpdateTasks = useCallback(async (updates: { taskId: string; updates: Partial<Task> }[]) => {
    console.log('🚀 batchUpdateTasks called with:', updates);

    const resolveTask = (id: string): Task | undefined => {
      const lookup = id.toString();
      return (dailyTasks || []).find(t => t.id?.toString?.() === lookup)
        || (allTasks || []).find(t => t.id?.toString?.() === lookup);
    };

    const mergeTasks = (current: Task[] | null, { constrainToDate }: { constrainToDate?: boolean } = {}) => {
      const map = new Map<string, Task>();
      (current || []).forEach(task => {
        map.set(task.id?.toString?.() ?? '', task);
      });

      updates.forEach(({ taskId, updates: partial }) => {
        const key = taskId?.toString?.() ?? '';
        if (!key) return;
        const original = map.get(key) ?? resolveTask(key);
        const merged: Task = {
          id: original?.id ?? key,
          content: partial.content ?? original?.content ?? '',
          completed: partial.completed ?? original?.completed ?? false,
          ...original,
          ...partial,
        };
        map.set(key, merged);
      });

      let next = Array.from(map.values());
      if (constrainToDate) {
        next = next.filter(task => task.due?.date === dateStr);
      }
      return next;
    };

    updateDailyOptimistically(tasks => mergeTasks(tasks, { constrainToDate: true }));
    updateAllOptimistically(tasks => mergeTasks(tasks));
    
    // Send batch update to server (soft-fail if API unreachable)
    try {
      if (todoistConnectedRef.current === false) {
        // Persist via Supabase
        const res = await fetch('/api/tasks/batch-update', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates })
        })
        if (!res.ok) console.warn('Supabase batch update failed')
        return
      }
      console.log('📡 Sending batch update to API...');
      const res = await fetch('/api/integrations/todoist/tasks/batch-update', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.warn('❌ Batch update non-OK:', res.status, errorText);
        // Soft recover: resync caches but do not throw (keep optimistic UI)
        refetchDaily();
        refetchAll();
        return;
      }
      const result = await res.json().catch(() => null);
      console.log('✅ Batch update successful:', result);
    } catch (error) {
      console.warn('💥 Batch update network error (continuing with optimistic state):', error);
      // Try Supabase; if offline, keep optimistic and skip
      try {
        await fetch('/api/tasks/batch-update', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates })
        })
      } catch {}
      refetchDaily();
      refetchAll();
      // Do not throw to avoid UI crash overlays
      return;
    }
  }, [updateDailyOptimistically, updateAllOptimistically, refetchDaily, refetchAll, allTasks, dailyTasks, dateStr])
  
  // Optimistic task deletion
  const deleteTask = useCallback(async (taskId: string) => {
    // Update optimistically by removing the task
    const updater = (tasks: Task[] | null) => 
      tasks?.filter(t => t.id.toString() !== taskId) || []
    
    updateDailyOptimistically(updater)
    updateAllOptimistically(updater)
    
    try {
      if (todoistConnectedRef.current === false) {
        const res = await fetch('/api/tasks/delete', {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId })
        })
        if (!res.ok) throw new Error('Failed to delete task (supabase)')
        return
      }
      const res = await fetch('/api/integrations/todoist/tasks/delete', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })
      
      if (!res.ok) throw new Error('Failed to delete task')
      
      
    } catch (error) {
      // On error, if offline/not connected, try Supabase or keep optimistic
      const isNetwork = error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('Network'))
      if (todoistConnectedRef.current === false || isNetwork) {
        try {
          await fetch('/api/tasks/delete', {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId })
          })
          return
        } catch {}
        return
      }
      // Otherwise refetch to correct state
      refetchDaily()
      refetchAll()
      throw error
    }
  }, [updateDailyOptimistically, updateAllOptimistically, refetchDaily, refetchAll])
  
  // Filter tasks for different views
  const dailyVisibleTasks = useMemo(() =>
    (dailyTasks || []).filter(t => !t.completed && !t.hourSlot),
    [dailyTasks]
  );

  const completedTasks = useMemo(() =>
    (allTasks || []).filter(t => t.completed),
    [allTasks]
  );

  const scheduledTasks = useMemo(() => {
    const targetDateStr = dateStr;

    const occursOnDate = (task: Task, todayStr: string) => {
      if (!task || task.completed || !task.hourSlot) return false;
      const dueDateStr = task.due?.date;
      if (!dueDateStr) {
        // Legacy tasks without a due date fallback to displaying whenever selected
        return true;
      }

      if (!task.repeatRule) {
        return dueDateStr === todayStr;
      }

      const target = new Date(`${todayStr}T00:00:00`);
      const due = new Date(`${dueDateStr}T00:00:00`);
      if (target < due) return false;

      const day = target.getDay();
      const dueDay = due.getDay();
      const diffDays = Math.floor((target.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));

      switch (task.repeatRule) {
        case 'daily':
          return true;
        case 'weekdays':
          return day >= 1 && day <= 5;
        case 'weekly':
          return diffDays % 7 === 0 && day === dueDay;
        case 'monthly': {
          const dueDateNum = due.getDate();
          const targetDateNum = target.getDate();
          const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
          if (dueDateNum > daysInTargetMonth) {
            return targetDateNum === daysInTargetMonth;
          }
          return targetDateNum === dueDateNum;
        }
        default:
          return false;
      }
    };

    const dailyScheduled = (dailyTasks || []).filter(t => occursOnDate(t as Task, targetDateStr));

    const allScheduled = (allTasks || []).filter(t => occursOnDate(t as Task, targetDateStr));

    const taskMap = new Map<string, Task>();
    [...dailyScheduled, ...allScheduled].forEach(task => {
      taskMap.set(task.id, task);
    });

    return Array.from(taskMap.values());
  }, [dailyTasks, allTasks, dateStr]);

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
