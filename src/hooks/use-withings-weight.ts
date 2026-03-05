import { useCallback, useRef } from 'react'
import { useGlobalCache } from './use-data-cache'

interface WithingsWeightData {
  weightKg: number
  weightLbs: number
  lastUpdated: string
  error?: string
}

interface UseWithingsWeightOptions {
  pollingInterval?: number // in milliseconds, default 5 minutes
  onNewData?: (data: WithingsWeightData) => void // callback when new data arrives
}

const DEFAULT_POLLING_INTERVAL = 5 * 60 * 1000 // 5 minutes
const CACHE_KEY = 'withings-weight-data'

export function useWithingsWeight(options: UseWithingsWeightOptions = {}) {
  const {
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    onNewData
  } = options

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
      const weightLbs = Math.round(weightKg * 2.20462 * 10) / 10

      const result: WithingsWeightData = {
        weightKg: Math.round(weightKg * 10) / 10,
        weightLbs,
        lastUpdated: new Date().toISOString(),
      }

      if (previousDataRef.current &&
          previousDataRef.current.weightKg !== result.weightKg) {
        onNewData?.(result)
      }

      previousDataRef.current = result
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        weightKg: 0,
        weightLbs: 0,
        lastUpdated: new Date().toISOString(),
        error: errorMessage
      }
    }
  }, [onNewData])

  // React Query handles staleness, refetchInterval, and refetchOnWindowFocus —
  // no need for manual setInterval or focus/visibility event listeners.
  const {
    data: weightData,
    loading,
    error,
    refetch,
    invalidate
  } = useGlobalCache<WithingsWeightData>(
    CACHE_KEY,
    fetchWithingsWeight,
    {
      ttl: pollingInterval,
      refetchInterval: pollingInterval,
      refetchOnWindowFocus: true,
    }
  )

  // Manual refresh
  const refreshNow = useCallback(async () => {
    invalidate()
    return refetch()
  }, [invalidate, refetch])

  return {
    weightData,
    loading,
    error,
    isPolling: true,
    refreshNow,
    isConnected: !error && !weightData?.error,
    hasData: !!weightData && !weightData.error,
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
