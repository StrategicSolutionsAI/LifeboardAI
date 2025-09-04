import { useCallback, useMemo } from 'react'
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
  created_at?: string
  updated_at?: string
}

interface TaskUpdate {
  taskId: string
  updates: Partial<Task>
}

// Custom hook for managing tasks with optimistic updates
export function useTasks(selectedDate?: Date) {
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
        throw new Error(`Failed to fetch daily tasks: ${res.status}`)
      }
      const data = await res.json()
      return Array.isArray(data) ? data : (data.tasks ?? [])
    } catch (error) {
      // Return empty array for network errors to prevent UI crashes
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
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
        throw new Error(`Failed to fetch all tasks: ${res.status}`)
      }
      const data = await res.json()
      return Array.isArray(data) ? data : (data.tasks ?? [])
    } catch (error) {
      // Return empty array for network errors to prevent UI crashes
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
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
    const trimmed = content.trim()
    if (!trimmed) return
    
    try {
      const res = await fetch('/api/integrations/todoist/tasks', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, due_date: dueDate, hour_slot: hourSlot, bucket }),
      })
      
      if (!res.ok) throw new Error('Failed to create task')
      
      const { task } = await res.json()

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
        updateDailyOptimistically(current => [...(current || []), enhancedTask as any])
      }
      updateAllOptimistically(current => [...(current || []), enhancedTask as any])
      
      return task
    } catch (error) {
      throw error
    }
  }, [dateStr, updateDailyOptimistically, updateAllOptimistically])
  
  // Optimistic task toggle
  const toggleTaskCompletion = useCallback(async (taskId: string) => {
    // Find the task
    const task = allTasks?.find(t => t.id === taskId) || 
                 dailyTasks?.find(t => t.id === taskId)
    
    if (!task) return
    
    const newCompleted = !task.completed
    
    // Update optimistically
    const updater = (tasks: Task[] | null) => 
      tasks?.map(t => t.id === taskId ? { ...t, completed: newCompleted } : t) || []
    
    updateDailyOptimistically(updater)
    updateAllOptimistically(updater)
    
    try {
      const endpoint = newCompleted 
        ? `/api/integrations/todoist/tasks/${taskId}/close`
        : `/api/integrations/todoist/tasks/${taskId}/reopen`
      
      const res = await fetch(endpoint, { 
        method: 'POST',
        credentials: 'same-origin'
      })
      if (!res.ok) throw new Error('Failed to toggle task')
    } catch (error) {
      // Revert on error
      const revertUpdater = (tasks: Task[] | null) => 
        tasks?.map(t => t.id === taskId ? { ...t, completed: !newCompleted } : t) || []
      
      updateDailyOptimistically(revertUpdater)
      updateAllOptimistically(revertUpdater)
      throw error
    }
  }, [allTasks, dailyTasks, updateDailyOptimistically, updateAllOptimistically])
  
  // Batch update for drag and drop
  const batchUpdateTasks = useCallback(async (updates: { taskId: string; updates: Partial<Task> }[]) => {
    // Update optimistically by applying updates to matching tasks
    const updater = (tasks: Task[] | null) => {
      if (!tasks) return []
      return tasks.map(task => {
        const update = updates.find(u => u.taskId === task.id)
        return update ? { ...task, ...update.updates } : task
      })
    }
    
    updateDailyOptimistically(updater)
    updateAllOptimistically(updater)
    
    // Send batch update to server
    try {
      const res = await fetch('/api/integrations/todoist/tasks/batch-update', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })
      
      if (!res.ok) throw new Error('Failed to batch update tasks')
    } catch (error) {
      // On error, refetch to get correct state
      refetchDaily()
      refetchAll()
      throw error
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
      const res = await fetch('/api/integrations/todoist/tasks/delete', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })
      
      if (!res.ok) throw new Error('Failed to delete task')
      
      
    } catch (error) {
      // On error, refetch to get correct state
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
