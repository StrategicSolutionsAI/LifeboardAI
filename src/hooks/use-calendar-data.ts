import { useCallback, useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useDataCache } from './use-data-cache'

interface CalendarEvent {
  id: string
  title: string
  date: string
  time?: string
  source: 'google' | 'todoist' | 'lifeboard'
}

interface CalendarDataOptions {
  selectedDate: Date
  fetchGoogleEvents?: boolean
  fetchTodoistTasks?: boolean
  delayMs?: number
}

/**
 * Optimized hook for fetching calendar data with staggered loading
 * This prevents all data sources from loading at once
 */
export function useCalendarData({
  selectedDate,
  fetchGoogleEvents = true,
  fetchTodoistTasks = true,
  delayMs = 100
}: CalendarDataOptions) {
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  
  // Google Calendar events fetcher
  const googleEventsFetcher = useCallback(async () => {
    if (!fetchGoogleEvents) return []
    
    try {
      const res = await fetch(`/api/integrations/google/calendar/events?date=${dateStr}`)
      if (!res.ok) {
        if (res.status === 401) return [] // Not connected
        throw new Error(`Failed to fetch Google Calendar events: ${res.status}`)
      }
      const data = await res.json()
      return Array.isArray(data) ? data : (data.events ?? [])
    } catch (error) {
      console.warn('Failed to fetch Google Calendar events:', error)
      return []
    }
  }, [dateStr, fetchGoogleEvents])
  
  // Use data cache for Google events with longer TTL
  const {
    data: googleEvents = [],
    loading: googleLoading,
    error: googleError,
    refetch: refetchGoogle
  } = useDataCache<CalendarEvent[]>(
    `calendar-google-${dateStr}`,
    googleEventsFetcher,
    {
      ttl: 10 * 60 * 1000, // 10 minutes
      prefetch: false // Don't prefetch on mount
    }
  )
  
  // Stagger the initial load
  useEffect(() => {
    if (isInitialLoad) {
      // Start loading Google events after a small delay
      const timer = setTimeout(() => {
        refetchGoogle()
        setIsInitialLoad(false)
      }, delayMs)
      
      return () => clearTimeout(timer)
    }
  }, [isInitialLoad, delayMs, refetchGoogle])
  
  // Return loading state that considers staggered loading
  const loading = isInitialLoad || googleLoading
  
  return {
    events: googleEvents,
    loading,
    error: googleError,
    refetch: refetchGoogle,
    isInitialLoad
  }
}

/**
 * Hook for fetching events only when calendar view changes
 */
export function useCalendarViewData(view: 'month' | 'week' | 'day', selectedDate: Date) {
  const [shouldFetch, setShouldFetch] = useState(false)
  const [cachedView, setCachedView] = useState<string | null>(null)
  
  useEffect(() => {
    const viewKey = `${view}-${format(selectedDate, 'yyyy-MM')}`
    
    // Only fetch if view has changed significantly
    if (viewKey !== cachedView) {
      setShouldFetch(true)
      setCachedView(viewKey)
      
      // Reset after fetching
      const timer = setTimeout(() => setShouldFetch(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [view, selectedDate, cachedView])
  
  return { shouldFetch }
}

/**
 * Hook to prefetch adjacent dates for smoother navigation
 */
export function usePrefetchAdjacentDates(selectedDate: Date) {
  const prevDate = new Date(selectedDate)
  prevDate.setDate(prevDate.getDate() - 1)
  
  const nextDate = new Date(selectedDate)
  nextDate.setDate(nextDate.getDate() + 1)
  
  const prevDateStr = format(prevDate, 'yyyy-MM-dd')
  const nextDateStr = format(nextDate, 'yyyy-MM-dd')
  
  // Prefetch previous day
  useDataCache(
    `calendar-prefetch-${prevDateStr}`,
    async () => {
      // Lightweight prefetch - just cache the response
      await fetch(`/api/integrations/todoist/tasks?date=${prevDateStr}`)
      return null
    },
    {
      ttl: 5 * 60 * 1000,
      prefetch: true
    }
  )
  
  // Prefetch next day
  useDataCache(
    `calendar-prefetch-${nextDateStr}`,
    async () => {
      // Lightweight prefetch - just cache the response
      await fetch(`/api/integrations/todoist/tasks?date=${nextDateStr}`)
      return null
    },
    {
      ttl: 5 * 60 * 1000,
      prefetch: true
    }
  )
}
