import { useCallback, useMemo, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { useDataCache } from './use-data-cache'

interface Task {
  id: string
  content: string
  completed: boolean
  due?: { date: string }
  duration?: number
  hourSlot?: string
  bucket?: string
  position?: number
  created_at?: string
  updated_at?: string
}

interface TaskUpdate {
  taskId: string
  updates: Partial<Task>
}

// Custom hook for managing tasks with optimistic updates
export function useTasks(selectedDate?: Date) {
  // Track whether Todoist is connected in this session; null = unknown
  const todoistConnectedRef = useRef<boolean | null>(null)

  const dateStr = selectedDate 
    ? format(selectedDate, 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd')
  
  
  // Cache key includes date for date-specific tasks
  const dailyCacheKey = `tasks-daily-${dateStr}`
  const allCacheKey = 'tasks-all-open'
  
  // Fetch daily tasks
  const dailyTasksFetcher = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations/todoist/tasks?date=${dateStr}`, {
        credentials: 'same-origin'
      })
      if (!res.ok) {
        // Handle auth and upstream errors gracefully
        if (res.status === 400 || res.status === 401) {
          // Treat as no Todoist connection – fall back to Supabase tasks
          todoistConnectedRef.current = false
          const supa = await fetch(`/api/tasks?date=${dateStr}`, { credentials: 'same-origin' })
          if (supa.ok) {
            const json = await supa.json()
            return Array.isArray(json) ? json : (json.tasks ?? [])
          }
          return []
        }
        if (res.status >= 500 || res.status === 429) {
          console.warn(`Upstream error fetching daily tasks: ${res.status} (treat as empty to avoid UI crash)`) 
          return []
        }
        throw new Error(`Failed to fetch daily tasks: ${res.status}`)
      }
      const data = await res.json()
      todoistConnectedRef.current = true
      return Array.isArray(data) ? data : (data.tasks ?? [])
    } catch (error) {
      // Network error – fall back to local tasks if available
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // Try Supabase API first
        try {
          const supa = await fetch(`/api/tasks?date=${dateStr}`, { credentials: 'same-origin' })
          if (supa.ok) {
            const json = await supa.json()
            return Array.isArray(json) ? json : (json.tasks ?? [])
          }
        } catch {}
        // Offline fallback to localStorage
        try {
          if (typeof window !== 'undefined') {
            const raw = window.localStorage.getItem('lifeboard_local_tasks')
            const list: Task[] = raw ? JSON.parse(raw) : []
            return list.filter(t => !t.completed && t.due?.date === dateStr)
          }
        } catch {}
        return []
      }
      throw error
    }
  }, [dateStr])
  
  // Fetch all open tasks
  const allTasksFetcher = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/todoist/tasks?all=true', {
        credentials: 'same-origin'
      })
      if (!res.ok) {
        // Handle auth and upstream errors gracefully
        if (res.status === 400 || res.status === 401) {
          // Treat as no Todoist connection – fall back to Supabase tasks
          todoistConnectedRef.current = false
          const supa = await fetch('/api/tasks?all=true', { credentials: 'same-origin' })
          if (supa.ok) {
            const json = await supa.json()
            return Array.isArray(json) ? json : (json.tasks ?? [])
          }
          return []
        }
        if (res.status >= 500 || res.status === 429) {
          console.warn(`Upstream error fetching all tasks: ${res.status} (treat as empty to avoid UI crash)`) 
          return []
        }
        throw new Error(`Failed to fetch all tasks: ${res.status}`)
      }
      const data = await res.json()
      todoistConnectedRef.current = true
      return Array.isArray(data) ? data : (data.tasks ?? [])
    } catch (error) {
      // Network error – try Supabase API, then local tasks
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        try {
          const supa = await fetch('/api/tasks?all=true', { credentials: 'same-origin' })
          if (supa.ok) {
            const json = await supa.json()
            return Array.isArray(json) ? json : (json.tasks ?? [])
          }
        } catch {}
        try {
          if (typeof window !== 'undefined') {
            const raw = window.localStorage.getItem('lifeboard_local_tasks')
            const list: Task[] = raw ? JSON.parse(raw) : []
            return list.filter(t => !t.completed)
          }
        } catch {}
        return []
      }
      throw error
    }
  }, [])
  
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
  const createTask = useCallback(async (content: string, dueDate: string | null, hourSlot?: number, bucket?: string) => {
    console.log('🔧 createTask hook called:', { content, dueDate, hourSlot, bucket });
    
    const trimmed = content.trim()
    if (!trimmed) {
      console.log('❌ createTask: Empty content, returning early');
      return;
    }
    
    // Helper: create local task and persist to localStorage
    const createLocalTask = (): any => {
      try {
        const id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
        body: JSON.stringify({ content, due_date: dueDate, hour_slot: hourSlot, bucket }),
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
            body: JSON.stringify({ content, due_date: dueDate, hour_slot: hourSlot, bucket })
          })
          if (alt.ok) {
            const json = await alt.json()
            const task = json.task
            if (dueDate === dateStr) {
              updateDailyOptimistically(current => [...(current || []), task as any])
            }
            updateAllOptimistically(current => [...(current || []), task as any])
            return task
          }
          // As last resort create local
          const local = createLocalTask()
          if (local) {
            if (dueDate === dateStr) updateDailyOptimistically(current => [...(current || []), local as any])
            updateAllOptimistically(current => [...(current || []), local as any])
            return local
          }
        }
        throw new Error(`Failed to create task: ${res.status} ${res.statusText}`);
      }
      
      const responseData = await res.json();
      console.log('📦 API response data:', responseData);
      const { task } = responseData;

      // Parse and normalize metadata so UI shows bucket/duration immediately
      let metadata: { duration?: number; hourSlot?: string; bucket?: string } = {}
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
      }

      // Add task to appropriate caches
      if (dueDate === dateStr) {
        console.log('📅 Adding task to daily cache for date:', dateStr);
        updateDailyOptimistically(current => [...(current || []), enhancedTask as any])
      }
      console.log('📋 Adding task to all tasks cache');
      updateAllOptimistically(current => [...(current || []), enhancedTask as any])
      
      console.log('✅ createTask returning task:', task);
      return task
    } catch (error) {
      console.error('💥 createTask error:', error);
      // Network or other errors – try Supabase, then local
      try {
        const alt = await fetch('/api/tasks', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, due_date: dueDate, hour_slot: hourSlot, bucket })
        })
        if (alt.ok) {
          const json = await alt.json()
          const task = json.task
          if (dueDate === dateStr) updateDailyOptimistically(current => [...(current || []), task as any])
          updateAllOptimistically(current => [...(current || []), task as any])
          return task
        }
      } catch {}
      const local = createLocalTask()
      if (local) {
        if (dueDate === dateStr) updateDailyOptimistically(current => [...(current || []), local as any])
        updateAllOptimistically(current => [...(current || []), local as any])
        return local
      }
      throw error
    }
  }, [dateStr, updateDailyOptimistically, updateAllOptimistically])

  // React to global refresh events (e.g., chat-created tasks)
  useEffect(() => {
    function onTasksUpdated() {
      try { refetchDaily() } catch {}
      try { refetchAll() } catch {}
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('lifeboard:tasks-updated', onTasksUpdated)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('lifeboard:tasks-updated', onTasksUpdated)
      }
    }
  }, [refetchDaily, refetchAll])
  
  // Optimistic task toggle
  const toggleTaskCompletion = useCallback(async (taskId: string) => {
    // Find the task
    const task = allTasks?.find(t => t.id?.toString?.() === taskId?.toString?.()) || 
                 dailyTasks?.find(t => t.id?.toString?.() === taskId?.toString?.())
    
    if (!task) return
    
    const newCompleted = !task.completed
    
    // Update optimistically
    const updater = (tasks: Task[] | null) => 
      tasks?.map(t => t.id === taskId ? { ...t, completed: newCompleted } : t) || []
    
    updateDailyOptimistically(updater)
    updateAllOptimistically(updater)
    
    try {
      if (todoistConnectedRef.current === false) {
        // Use Supabase API for completion toggle
        const endpoint = newCompleted ? '/api/tasks/complete' : '/api/tasks/reopen'
        const res = await fetch(endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId })
        })
        if (!res.ok) throw new Error('Failed to toggle task (supabase)')
        return
      }
      const endpoint = newCompleted 
        ? `/api/integrations/todoist/tasks/complete`
        : `/api/integrations/todoist/tasks/reopen`
      
      const res = await fetch(endpoint, { 
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })
      if (!res.ok) throw new Error('Failed to toggle task')
    } catch (error) {
      // If server not reachable or not connected, try Supabase; otherwise persist locally
      const isNetwork = error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('Network'))
      if (todoistConnectedRef.current === false || isNetwork) {
        try {
          const endpoint = newCompleted ? '/api/tasks/complete' : '/api/tasks/reopen'
          const res = await fetch(endpoint, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId })
          })
          if (res.ok) return
        } catch {}
        // Offline local persistence
        try {
          if (typeof window !== 'undefined') {
            const raw = window.localStorage.getItem('lifeboard_local_tasks')
            const list: Task[] = raw ? JSON.parse(raw) : []
            const updated = list.map(t => t.id?.toString?.() === taskId?.toString?.() ? { ...t, completed: newCompleted, updated_at: new Date().toISOString() } : t)
            window.localStorage.setItem('lifeboard_local_tasks', JSON.stringify(updated))
          }
        } catch {}
        return
      }
      // Otherwise revert on true server error
      const revertUpdater = (tasks: Task[] | null) => 
        tasks?.map(t => t.id === taskId ? { ...t, completed: !newCompleted } : t) || []
      updateDailyOptimistically(revertUpdater)
      updateAllOptimistically(revertUpdater)
      throw error
    }
  }, [allTasks, dailyTasks, updateDailyOptimistically, updateAllOptimistically])
  
  // Batch update for drag and drop
  const batchUpdateTasks = useCallback(async (updates: { taskId: string; updates: Partial<Task> }[]) => {
    console.log('🚀 batchUpdateTasks called with:', updates);
    
    // Update optimistically by applying updates to matching tasks
    const updater = (tasks: Task[] | null) => {
      if (!tasks) return []
      return tasks.map(task => {
        const update = updates.find(u => u.taskId?.toString?.() === task.id?.toString?.())
        return update ? { ...task, ...update.updates } : task
      })
    }
    
    updateDailyOptimistically(updater)
    updateAllOptimistically(updater)
    
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
  }, [updateDailyOptimistically, updateAllOptimistically, refetchDaily, refetchAll])
  
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

  const scheduledTasks = useMemo(() => {
    // Use the selected date for context instead of always "today"
    const targetDateStr = dateStr;

    // From daily tasks (already scoped to selected date)
    const dailyScheduled = (dailyTasks || []).filter(t => !t.completed && t.hourSlot);

    // From all tasks: include tasks with hourSlot that are undated or dated to the selected date
    const allScheduled = (allTasks || []).filter(t => {
      if (t.completed || !t.hourSlot) return false;
      return !t.due?.date || t.due.date === targetDateStr;
    });

    // Combine and deduplicate by id
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
