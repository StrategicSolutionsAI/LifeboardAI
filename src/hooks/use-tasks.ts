import { useState, useCallback, useEffect } from 'react'
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
    ? selectedDate.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]
  
  // Cache key includes date for date-specific tasks
  const dailyCacheKey = `tasks-daily-${dateStr}`
  const allCacheKey = 'tasks-all-open'
  
  // Fetch daily tasks
  const dailyTasksFetcher = useCallback(async () => {
    const res = await fetch(`/api/integrations/todoist/tasks?date=${dateStr}`)
    if (!res.ok) throw new Error('Failed to fetch daily tasks')
    const data = await res.json()
    return Array.isArray(data) ? data : (data.tasks ?? [])
  }, [dateStr])
  
  // Fetch all open tasks
  const allTasksFetcher = useCallback(async () => {
    const res = await fetch('/api/integrations/todoist/tasks?all=true')
    if (!res.ok) throw new Error('Failed to fetch all tasks')
    const data = await res.json()
    return Array.isArray(data) ? data : (data.tasks ?? [])
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
    prefetch: true
  })
  
  const {
    data: allTasks,
    loading: allLoading,
    error: allError,
    updateOptimistically: updateAllOptimistically,
    refetch: refetchAll
  } = useDataCache<Task[]>(allCacheKey, allTasksFetcher, {
    ttl: 10 * 60 * 1000, // 10 minutes
    prefetch: true
  })
  
  // Optimistic task creation
  const createTask = useCallback(async (content: string, dueDate: string | null) => {
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
        body: JSON.stringify({ content: trimmed, dueDate })
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
  
  return {
    dailyTasks: dailyTasks || [],
    allTasks: allTasks || [],
    loading: dailyLoading || allLoading,
    error: dailyError || allError,
    createTask,
    toggleTaskCompletion,
    batchUpdateTasks,
    refetch: () => {
      refetchDaily()
      refetchAll()
    }
  }
}
