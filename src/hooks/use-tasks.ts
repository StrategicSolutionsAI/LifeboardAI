import { useState, useCallback, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { useDataCache } from './use-data-cache'

interface Task {
  id: string
  content: string
  completed: boolean
  due?: { date: string }
  duration?: number
  hourSlot?: string
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
      const res = await fetch(`/api/integrations/todoist/tasks?date=${dateStr}`)
      if (!res.ok) {
        const errorText = await res.text()
        console.error(`Daily tasks API error: ${res.status} ${res.statusText}`, errorText)
        throw new Error(`Failed to fetch daily tasks: ${res.status} ${res.statusText}`)
      }
      const data = await res.json()
      const tasks = Array.isArray(data) ? data : (data.tasks ?? [])
      return tasks
    } catch (error) {
      console.error('Network error fetching daily tasks:', error)
      // Return empty array instead of throwing to prevent UI crashes
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('Todoist integration may not be configured. Returning empty tasks.')
        return []
      }
      throw error
    }
  }, [dateStr])
  
  // Fetch all open tasks
  const allTasksFetcher = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/todoist/tasks?all=true')
      if (!res.ok) {
        const errorText = await res.text()
        console.error(`All tasks API error: ${res.status} ${res.statusText}`, errorText)
        throw new Error(`Failed to fetch all tasks: ${res.status} ${res.statusText}`)
      }
      const data = await res.json()
      return Array.isArray(data) ? data : (data.tasks ?? [])
    } catch (error) {
      console.error('Network error fetching all tasks:', error)
      // Return empty array instead of throwing to prevent UI crashes
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('Todoist integration may not be configured. Returning empty tasks.')
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
    ttl: 10 * 60 * 1000, // 10 minutes
    prefetch: false // Don't prefetch to avoid immediate errors on mount
  })
  
  // Optimistic task creation
  const createTask = useCallback(async (content: string, dueDate: string | null, hourSlot?: number) => {
    const trimmed = content.trim()
    if (!trimmed) return
    
    const tempId = `temp-${Date.now()}`
    const optimisticTask: Task = {
      id: tempId,
      content: trimmed,
      completed: false,
      due: dueDate ? { date: dueDate } : undefined,
      created_at: new Date().toISOString()
    }
    
    // Update cache optimistically
    if (dueDate === dateStr) {
      updateDailyOptimistically(current => [...(current || []), optimisticTask])
    }
    updateAllOptimistically(current => [...(current || []), optimisticTask])
    
    try {
      const res = await fetch('/api/integrations/todoist/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, due_date: dueDate, hour_slot: hourSlot }),
      })
      
      if (!res.ok) throw new Error('Failed to create task')
      
      const { task } = await res.json()
      
      // Replace temp task with real task
      if (dueDate === dateStr) {
        updateDailyOptimistically(current => 
          current?.map((t: any) => t.id === tempId ? task : t) || []
        )
      }
      updateAllOptimistically(current => 
        current?.map((t: any) => t.id === tempId ? task : t) || []
      )
      
      return task
    } catch (error) {
      // Revert optimistic update on error
      if (dueDate === dateStr) {
        updateDailyOptimistically(current => 
          current?.filter((t: any) => t.id !== tempId) || []
        )
      }
      updateAllOptimistically(current => 
        current?.filter((t: any) => t.id !== tempId) || []
      )
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
      
      const res = await fetch(endpoint, { method: 'POST' })
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
  const batchUpdateTasks = useCallback(async (updates: TaskUpdate[]) => {
    // Apply optimistic updates
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
      tasks?.filter(t => t.id !== taskId) || []
    
    updateDailyOptimistically(updater)
    updateAllOptimistically(updater)
    
    try {
      const res = await fetch('/api/integrations/todoist/tasks/delete', {
        method: 'DELETE',
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
  
  // Properly filter tasks for different views
  const dailyVisibleTasks = useMemo(() => 
    (dailyTasks || []).filter(t => !t.completed && !t.hourSlot),
    [dailyTasks]
  );

  const scheduledTasks = useMemo(() => 
    (dailyTasks || []).filter(t => !t.completed && t.hourSlot),
    [dailyTasks]
  );

  return {
    dailyTasks: dailyTasks || [],
    allTasks: allTasks || [],
    dailyVisibleTasks, // Tasks that should appear in daily list (no hourSlot)
    scheduledTasks,    // Tasks that should appear in hourly planner (has hourSlot)
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
