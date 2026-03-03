import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query-client'

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

interface CacheOptions {
  ttl?: number
  prefetch?: boolean
  optimisticUpdate?: boolean
}

// ── Global invalidation (callable outside React) ────────────────────────

export function invalidateTaskCaches() {
  const qc = getQueryClient()
  qc.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0]
      return typeof key === 'string' && key.startsWith('tasks-')
    },
  })
}

export function invalidateIntegrationCaches(integrationId?: string) {
  const qc = getQueryClient()
  qc.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0]
      if (typeof key !== 'string') return false
      if (integrationId) {
        return (
          key.includes(integrationId) ||
          key.startsWith(`${integrationId}-`) ||
          key.endsWith(`-${integrationId}`) ||
          key.includes(`/${integrationId}/`)
        )
      }
      return [
        'todoist', 'withings', 'fitbit', 'google',
        'nutrition', 'weight', 'metrics', 'calendar', 'events',
      ].some((k) => key.includes(k))
    },
  })
}

export function invalidateAllCaches() {
  const qc = getQueryClient()
  qc.invalidateQueries()
}

/**
 * Seed the React Query cache before React mounts (e.g. at module evaluation time).
 * When a useDataCache hook later mounts with the same key, React Query finds
 * either resolved data or an in-flight promise and skips its own fetch.
 */
export function prefetchToGlobalCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL,
): void {
  if (typeof window === 'undefined') return
  const qc = getQueryClient()
  qc.prefetchQuery({
    queryKey: [key],
    queryFn: fetcher,
    staleTime: ttl,
  })
}

// ── React hooks (drop-in replacements backed by React Query) ────────────

export function useDataCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {},
) {
  const { ttl = DEFAULT_TTL } = options
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery<T>({
    queryKey: [key],
    queryFn: fetcher,
    staleTime: ttl,
    gcTime: ttl * 2,
  })

  const updateOptimistically = useCallback(
    (updater: (current: T | null) => T) => {
      queryClient.setQueryData<T>([key], (old) => updater(old ?? null))
    },
    [queryClient, key],
  )

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [key] })
  }, [queryClient, key])

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ?? null,
    refetch,
    updateOptimistically,
    invalidate,
  }
}

export function useGlobalCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {},
) {
  const { ttl = DEFAULT_TTL } = options
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery<T>({
    queryKey: [key],
    queryFn: fetcher,
    staleTime: ttl,
    gcTime: ttl * 2,
  })

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [key] })
  }, [queryClient, key])

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ?? null,
    refetch,
    invalidate,
  }
}
