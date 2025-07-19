import { useState, useEffect, useCallback, useRef } from 'react'
import { useGlobalCache } from './use-data-cache'

interface WithingsWeightData {
  weightKg: number
  weightLbs: number
  lastUpdated: string
  error?: string
}

interface UseWithingsWeightOptions {
  pollingInterval?: number // in milliseconds, default 5 minutes
  autoStart?: boolean // whether to start polling immediately
  onNewData?: (data: WithingsWeightData) => void // callback when new data arrives
}

const DEFAULT_POLLING_INTERVAL = 5 * 60 * 1000 // 5 minutes
const CACHE_KEY = 'withings-weight-data'

export function useWithingsWeight(options: UseWithingsWeightOptions = {}) {
  const {
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    autoStart = true,
    onNewData
  } = options

  const [isPolling, setIsPolling] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const previousDataRef = useRef<WithingsWeightData | null>(null)

  // Fetcher function for the cache
  const fetchWithingsWeight = useCallback(async (): Promise<WithingsWeightData> => {
    try {
      const response = await fetch('/api/integrations/withings/metrics')
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limited - please try again later')
        }
        if (response.status === 401) {
          const errorData = await response.json().catch(() => ({}))
          if (errorData.needsReauth) {
            throw new Error('Withings connection expired - please reconnect your account')
          }
          throw new Error('Not authenticated - please reconnect Withings')
        }
        if (response.status === 400) {
          throw new Error('Withings not connected - please set up integration')
        }
        throw new Error(`Failed to fetch weight data: ${response.status}`)
      }

      const data = await response.json()
      const weightKg = data.weightKg
      const weightLbs = Math.round(weightKg * 2.20462 * 10) / 10 // Convert to lbs with 1 decimal

      const result: WithingsWeightData = {
        weightKg: Math.round(weightKg * 10) / 10, // Round to 1 decimal
        weightLbs,
        lastUpdated: new Date().toISOString(),
      }

      // Check if this is new data compared to previous fetch
      if (previousDataRef.current && 
          previousDataRef.current.weightKg !== result.weightKg) {
        onNewData?.(result)
      }
      
      previousDataRef.current = result
      setLastFetchTime(new Date())
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const result: WithingsWeightData = {
        weightKg: 0,
        weightLbs: 0,
        lastUpdated: new Date().toISOString(),
        error: errorMessage
      }
      
      setLastFetchTime(new Date())
      return result
    }
  }, [onNewData])

  // Use the global cache for data management
  const {
    data: weightData,
    loading,
    error,
    refetch,
    invalidate
  } = useGlobalCache<WithingsWeightData>(
    CACHE_KEY,
    fetchWithingsWeight,
    { ttl: pollingInterval }
  )

  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    setIsPolling(true)
    
    // Fetch immediately
    refetch()
    
    // Set up interval for subsequent fetches
    intervalRef.current = setInterval(() => {
      refetch()
    }, pollingInterval)
  }, [refetch, pollingInterval])

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsPolling(false)
  }, [])

  // Manual refresh
  const refreshNow = useCallback(async () => {
    invalidate() // Clear cache to force fresh fetch
    return refetch()
  }, [invalidate, refetch])

  // Auto-start polling on mount if enabled
  useEffect(() => {
    if (autoStart) {
      startPolling()
    }

    // Cleanup on unmount
    return () => {
      stopPolling()
    }
  }, [autoStart, startPolling, stopPolling])

  // Check for new data when component becomes visible (Page Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPolling) {
        // Refresh data when page becomes visible
        refreshNow()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isPolling, refreshNow])

  // Check for new data when window gains focus
  useEffect(() => {
    const handleFocus = () => {
      if (isPolling) {
        refreshNow()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [isPolling, refreshNow])

  return {
    // Data
    weightData,
    loading,
    error,
    lastFetchTime,
    
    // Polling controls
    isPolling,
    startPolling,
    stopPolling,
    refreshNow,
    
    // Utilities
    isConnected: !error && !weightData?.error,
    hasData: !!weightData && !weightData.error,
    nextFetchIn: isPolling && lastFetchTime 
      ? Math.max(0, pollingInterval - (Date.now() - lastFetchTime.getTime()))
      : null
  }
}

// Utility function to check if Withings is connected
export async function checkWithingsConnection(): Promise<boolean> {
  try {
    const response = await fetch('/api/integrations/withings/metrics')
    return response.ok
  } catch {
    return false
  }
}

// Utility function to get the latest weight without polling
export async function getLatestWeight(): Promise<WithingsWeightData | null> {
  try {
    const response = await fetch('/api/integrations/withings/metrics')
    if (!response.ok) return null
    
    const data = await response.json()
    const weightKg = data.weightKg
    const weightLbs = Math.round(weightKg * 2.20462 * 10) / 10

    return {
      weightKg: Math.round(weightKg * 10) / 10,
      weightLbs,
      lastUpdated: new Date().toISOString(),
    }
  } catch {
    return null
  }
}
