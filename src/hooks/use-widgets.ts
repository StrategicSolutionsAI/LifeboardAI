import { useState, useCallback, useRef, useEffect } from 'react'
import { useGlobalCache } from './use-data-cache'
import { getUserPreferencesClient, saveUserPreferences } from '@/lib/user-preferences'
import type { WidgetInstance } from '@/types/widgets'

interface ProgressEntry {
  value: number
  date: string
  streak: number
  lastCompleted: string
}

// Debounce function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

export function useWidgets() {
  // Use global cache for user preferences
  const {
    data: userPrefs,
    loading: prefsLoading,
    refetch: refetchPrefs
  } = useGlobalCache('user-preferences', getUserPreferencesClient, {
    ttl: 10 * 60 * 1000 // 10 minutes
  })
  
  // Local state for widgets and progress
  const [widgetsByBucket, setWidgetsByBucket] = useState<Record<string, WidgetInstance[]>>({})
  const [progressByWidget, setProgressByWidget] = useState<Record<string, ProgressEntry>>({})
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  // Ref for debouncing
  const widgetsByBucketRef = useRef(widgetsByBucket)
  const progressByWidgetRef = useRef(progressByWidget)
  
  // Update refs when state changes
  useEffect(() => {
    widgetsByBucketRef.current = widgetsByBucket
  }, [widgetsByBucket])
  
  useEffect(() => {
    progressByWidgetRef.current = progressByWidget
  }, [progressByWidget])
  
  // Initialize from user preferences
  useEffect(() => {
    if (userPrefs) {
      setWidgetsByBucket(userPrefs.widgets_by_bucket || {})
      setProgressByWidget(userPrefs.progress_by_widget || {})
    }
  }, [userPrefs])
  
  // Save to both localStorage and Supabase
  const saveWidgets = useCallback(async (
    widgets: Record<string, WidgetInstance[]>,
    progress?: Record<string, ProgressEntry>
  ) => {
    setSavingStatus('saving')
    
    // Save to localStorage immediately for instant persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('widgets_by_bucket', JSON.stringify(widgets))
      if (progress) {
        localStorage.setItem('progress_by_widget', JSON.stringify(progress))
      }
    }
    
    // Save to Supabase
    try {
      const currentPrefs = await getUserPreferencesClient()
      if (currentPrefs) {
        const success = await saveUserPreferences({
          ...currentPrefs,
          widgets_by_bucket: widgets,
          progress_by_widget: progress || currentPrefs.progress_by_widget || {}
        })
        
        setSavingStatus(success ? 'saved' : 'error')
        
        // Reset status after a delay
        setTimeout(() => setSavingStatus('idle'), 2000)
      }
    } catch (error) {
      console.error('Failed to save widgets:', error)
      setSavingStatus('error')
      setTimeout(() => setSavingStatus('idle'), 2000)
    }
  }, [])
  
  // Debounced save function
  const debouncedSave = useRef(
    debounce(() => {
      saveWidgets(widgetsByBucketRef.current, progressByWidgetRef.current)
    }, 1000)
  ).current
  
  // Add widget to bucket
  const addWidget = useCallback((bucket: string, widget: WidgetInstance) => {
    setWidgetsByBucket(prev => {
      const updated = { ...prev }
      updated[bucket] = [...(updated[bucket] || []), widget]
      return updated
    })
    debouncedSave()
  }, [debouncedSave])
  
  // Remove widget
  const removeWidget = useCallback((bucket: string, widgetId: string) => {
    setWidgetsByBucket(prev => {
      const updated = { ...prev }
      updated[bucket] = (updated[bucket] || []).filter(w => w.instanceId !== widgetId)
      return updated
    })
    
    // Also remove progress data
    setProgressByWidget(prev => {
      const updated = { ...prev }
      delete updated[widgetId]
      return updated
    })
    
    debouncedSave()
  }, [debouncedSave])
  
  // Update widget
  const updateWidget = useCallback((bucket: string, widgetId: string, updates: Partial<WidgetInstance>) => {
    setWidgetsByBucket(prev => {
      const updated = { ...prev }
      updated[bucket] = (updated[bucket] || []).map(w => 
        w.instanceId === widgetId ? { ...w, ...updates } : w
      )
      return updated
    })
    debouncedSave()
  }, [debouncedSave])
  
  // Update progress
  const updateProgress = useCallback((widgetId: string, value: number) => {
    const today = new Date().toISOString().split('T')[0]
    
    setProgressByWidget(prev => {
      const current = prev[widgetId]
      const lastDate = current?.date
      const isToday = lastDate === today
      const isYesterday = lastDate === new Date(Date.now() - 86400000).toISOString().split('T')[0]
      
      return {
        ...prev,
        [widgetId]: {
          value: isToday ? current.value + value : value,
          date: today,
          streak: isToday ? current.streak : (isYesterday ? current.streak + 1 : 1),
          lastCompleted: today
        }
      }
    })
    
    debouncedSave()
  }, [debouncedSave])
  
  // Batch update widgets (for drag and drop)
  const batchUpdateWidgets = useCallback((updates: Record<string, WidgetInstance[]>) => {
    setWidgetsByBucket(updates)
    debouncedSave()
  }, [debouncedSave])
  
  // Get widgets for a specific bucket
  const getWidgetsForBucket = useCallback((bucket: string) => {
    return widgetsByBucket[bucket] || []
  }, [widgetsByBucket])
  
  // Get progress for a widget
  const getProgressForWidget = useCallback((widgetId: string) => {
    const progress = progressByWidget[widgetId]
    const today = new Date().toISOString().split('T')[0]
    
    if (!progress || progress.date !== today) {
      return { value: 0, streak: progress?.streak || 0, isToday: false }
    }
    
    return { value: progress.value, streak: progress.streak, isToday: true }
  }, [progressByWidget])
  
  return {
    widgetsByBucket,
    progressByWidget,
    loading: prefsLoading,
    savingStatus,
    addWidget,
    removeWidget,
    updateWidget,
    updateProgress,
    batchUpdateWidgets,
    getWidgetsForBucket,
    getProgressForWidget,
    refetch: refetchPrefs
  }
}
