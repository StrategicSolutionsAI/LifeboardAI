import { useState, useEffect, useCallback, useRef } from 'react'

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

interface CacheOptions {
  ttl?: number // Time to live in milliseconds (default: 5 minutes)
  prefetch?: boolean // Whether to prefetch data on mount
  optimisticUpdate?: boolean // Whether to update cache optimistically
}

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
const CACHE_UPDATE_EVENT = 'lifeboard:data-cache-update'

// Global cache for sharing between components
const globalCache = new Map<string, CacheEntry<any>>()
const globalPendingRequests = new Map<string, Promise<any>>()

function emitCacheUpdate(key: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CACHE_UPDATE_EVENT, { detail: { key } }))
}

// Global cache invalidation functions that can be called from anywhere
export function invalidateTaskCaches() {
  // Find and delete all task-related cache entries
  const keysToDelete: string[] = []
  globalCache.forEach((_, key) => {
    if (key.startsWith('tasks-')) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach(key => globalCache.delete(key))
  keysToDelete.forEach(key => globalPendingRequests.delete(key))
  keysToDelete.forEach(key => emitCacheUpdate(key))
}

// Invalidate all integration-related caches
export function invalidateIntegrationCaches(integrationId?: string) {
  const keysToDelete: string[] = []
  globalCache.forEach((_, key) => {
    // If specific integration ID provided, only clear that integration's cache
    if (integrationId) {
      if (key.includes(integrationId) || 
          key.startsWith(`${integrationId}-`) ||
          key.endsWith(`-${integrationId}`) ||
          key.includes(`/${integrationId}/`)) {
        keysToDelete.push(key)
      }
    } else {
      // Clear all integration-related caches
      if (key.includes('todoist') || 
          key.includes('withings') || 
          key.includes('fitbit') || 
          key.includes('google') || 
          key.includes('nutrition') ||
          key.includes('weight') ||
          key.includes('metrics') ||
          key.includes('calendar') ||
          key.includes('events')) {
        keysToDelete.push(key)
      }
    }
  })
  keysToDelete.forEach(key => globalCache.delete(key))
  keysToDelete.forEach(key => globalPendingRequests.delete(key))
  keysToDelete.forEach(key => emitCacheUpdate(key))
}

// Invalidate all caches (nuclear option)
export function invalidateAllCaches() {
  globalCache.clear()
  globalPendingRequests.clear()
  emitCacheUpdate('*')
}

export function useDataCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
) {
  const { ttl = DEFAULT_TTL, prefetch = false, optimisticUpdate = true } = options
  
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map())
  const pendingRef = useRef<Map<string, Promise<T>>>(new Map())
  const requestVersionRef = useRef(0)

  const [data, setData] = useState<T | null>(() => {
    const cached = globalCache.get(key) as CacheEntry<T> | undefined
    if (cached && Date.now() < cached.expiresAt) {
      cacheRef.current.set(key, cached)
      return cached.data as T
    }
    return null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const getLatestRequestVersion = useCallback(() => requestVersionRef.current, [])
  const advanceRequestVersion = useCallback(() => {
    requestVersionRef.current += 1
    return requestVersionRef.current
  }, [])
  const isLatestRequest = useCallback(
    (version: number) => version === getLatestRequestVersion(),
    [getLatestRequestVersion]
  )
  const setDataIfLatest = useCallback(
    (version: number, nextData: T) => {
      if (isLatestRequest(version)) {
        setData(nextData)
      }
    },
    [isLatestRequest]
  )
  const setErrorIfLatest = useCallback(
    (version: number, nextError: Error | null) => {
      if (isLatestRequest(version)) {
        setError(nextError)
      }
    },
    [isLatestRequest]
  )
  const setLoadingIfLatest = useCallback(
    (version: number, nextLoading: boolean) => {
      if (isLatestRequest(version)) {
        setLoading(nextLoading)
      }
    },
    [isLatestRequest]
  )
  
  // Check if cache entry is still valid
  const isValidCache = useCallback((entry: CacheEntry<T>) => {
    return Date.now() < entry.expiresAt
  }, [])
  
  // Get from cache or fetch
  const fetchWithCache = useCallback(async () => {
    const requestVersion = advanceRequestVersion()

    const localCached = cacheRef.current.get(key)
    if (localCached && isValidCache(localCached)) {
      setDataIfLatest(requestVersion, localCached.data)
      return localCached.data
    }

    const globalCached = globalCache.get(key) as CacheEntry<T> | undefined
    if (globalCached && isValidCache(globalCached)) {
      cacheRef.current.set(key, globalCached)
      setDataIfLatest(requestVersion, globalCached.data)
      return globalCached.data
    }

    const localPending = pendingRef.current.get(key)
    if (localPending) {
      setLoadingIfLatest(requestVersion, true)
      try {
        const result = await localPending
        setDataIfLatest(requestVersion, result)
        return result
      } catch (err) {
        setErrorIfLatest(requestVersion, err as Error)
        throw err
      } finally {
        setLoadingIfLatest(requestVersion, false)
      }
    }

    const globalPending = globalPendingRequests.get(key) as Promise<T> | undefined
    if (globalPending) {
      pendingRef.current.set(key, globalPending)
      setLoadingIfLatest(requestVersion, true)
      try {
        const result = await globalPending
        setDataIfLatest(requestVersion, result)
        return result
      } catch (err) {
        setErrorIfLatest(requestVersion, err as Error)
        throw err
      } finally {
        setLoadingIfLatest(requestVersion, false)
      }
    }

    // Fetch new data
    setLoadingIfLatest(requestVersion, true)
    setErrorIfLatest(requestVersion, null)
    
    const loadPromise = (async () => {
      const result = await fetcher()
      const now = Date.now()
      const entry: CacheEntry<T> = {
        data: result,
        timestamp: now,
        expiresAt: now + ttl
      }
      cacheRef.current.set(key, entry)
      globalCache.set(key, entry)
      emitCacheUpdate(key)
      return result
    })()

    pendingRef.current.set(key, loadPromise)
    globalPendingRequests.set(key, loadPromise)

    try {
      const result = await loadPromise
      setDataIfLatest(requestVersion, result)
      return result
    } catch (err) {
      setErrorIfLatest(requestVersion, err as Error)
      throw err
    } finally {
      setLoadingIfLatest(requestVersion, false)
      pendingRef.current.delete(key)
      globalPendingRequests.delete(key)
    }
  }, [
    key,
    fetcher,
    ttl,
    isValidCache,
    advanceRequestVersion,
    setDataIfLatest,
    setErrorIfLatest,
    setLoadingIfLatest
  ])
  
  // Optimistic update function
  const updateOptimistically = useCallback((updater: (current: T | null) => T) => {
    if (!optimisticUpdate) return
    advanceRequestVersion()
    
    const newData = updater(data)
    setData(newData)
    
    // Update cache immediately
    const now = Date.now()
    const entry: CacheEntry<T> = {
      data: newData,
      timestamp: now,
      expiresAt: now + ttl
    }
    cacheRef.current.set(key, entry)
    globalCache.set(key, entry)
    emitCacheUpdate(key)
  }, [data, key, ttl, optimisticUpdate, advanceRequestVersion])
  
  // Invalidate cache entry
  const invalidate = useCallback(() => {
    advanceRequestVersion()
    cacheRef.current.delete(key)
    globalCache.delete(key)
    pendingRef.current.delete(key)
    globalPendingRequests.delete(key)
    emitCacheUpdate(key)
  }, [key, advanceRequestVersion])
  
  // Refetch data (bypassing cache)
  const refetch = useCallback(async () => {
    invalidate()
    return fetchWithCache()
  }, [invalidate, fetchWithCache])
  
  // Initial fetch
  useEffect(() => {
    if (prefetch || data === null) {
      void fetchWithCache().catch(() => {
        // Error state is already handled inside fetchWithCache; avoid unhandled promise rejections.
      })
    }
  }, [prefetch, data, fetchWithCache])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onCacheUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>
      const changedKey = customEvent.detail?.key
      if (changedKey !== key && changedKey !== '*') return

      const cached = globalCache.get(key) as CacheEntry<T> | undefined
      if (cached && Date.now() < cached.expiresAt) {
        cacheRef.current.set(key, cached)
        setData(cached.data)
      }
    }

    window.addEventListener(CACHE_UPDATE_EVENT, onCacheUpdate as EventListener)
    return () => {
      window.removeEventListener(CACHE_UPDATE_EVENT, onCacheUpdate as EventListener)
    }
  }, [key])
  
  return {
    data,
    loading,
    error,
    refetch,
    updateOptimistically,
    invalidate
  }
}

// Hook for using global cache
export function useGlobalCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
) {
  const { ttl = DEFAULT_TTL } = options
  
  const [data, setData] = useState<T | null>(() => {
    const cached = globalCache.get(key)
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data
    }
    return null
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const fetchData = useCallback(async (bypassCache = false) => {
    // Check cache unless bypassing
    if (!bypassCache) {
      const cached = globalCache.get(key)
      if (cached && Date.now() < cached.expiresAt) {
        setData(cached.data)
        return cached.data
      }
    }

    const pending = globalPendingRequests.get(key) as Promise<T> | undefined
    if (pending) {
      setLoading(true)
      try {
        const result = await pending
        setData(result)
        return result
      } catch (err) {
        setError(err as Error)
        throw err
      } finally {
        setLoading(false)
      }
    }
    
    setLoading(true)
    setError(null)
    
    const loadPromise = (async () => {
      const result = await fetcher()
      globalCache.set(key, {
        data: result,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl
      })
      emitCacheUpdate(key)
      return result
    })()
    globalPendingRequests.set(key, loadPromise)

    try {
      const result = await loadPromise
      setData(result)
      return result
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      globalPendingRequests.delete(key)
      setLoading(false)
    }
  }, [key, fetcher, ttl])
  
  const invalidate = useCallback(() => {
    globalCache.delete(key)
    globalPendingRequests.delete(key)
    emitCacheUpdate(key)
  }, [key])
  
  const refetch = useCallback(() => {
    return fetchData(true)
  }, [fetchData])
  
  // Subscribe to cache updates from other components
  useEffect(() => {
    if (typeof window === 'undefined') return

    const onCacheUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>
      const changedKey = customEvent.detail?.key
      if (changedKey !== key && changedKey !== '*') return

      const cached = globalCache.get(key)
      if (cached && Date.now() < cached.expiresAt) {
        setData(cached.data)
      }
    }

    window.addEventListener(CACHE_UPDATE_EVENT, onCacheUpdate as EventListener)
    return () => {
      window.removeEventListener(CACHE_UPDATE_EVENT, onCacheUpdate as EventListener)
    }
  }, [key])
  
  // Initial fetch if no cached data
  useEffect(() => {
    if (data === null) {
      fetchData()
    }
  }, [data, fetchData])
  
  return {
    data,
    loading,
    error,
    refetch,
    invalidate
  }
}
