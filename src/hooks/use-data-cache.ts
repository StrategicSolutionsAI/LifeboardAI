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

// Global cache for sharing between components
const globalCache = new Map<string, CacheEntry<any>>()
const globalPendingRequests = new Map<string, Promise<any>>()

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
}

// Invalidate all caches (nuclear option)
export function invalidateAllCaches() {
  const count = globalCache.size
  globalCache.clear()
  globalPendingRequests.clear()
}

export function useDataCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
) {
  const { ttl = DEFAULT_TTL, prefetch = false, optimisticUpdate = true } = options
  
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map())
  const pendingRef = useRef<Map<string, Promise<T>>>(new Map())

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
  
  // Check if cache entry is still valid
  const isValidCache = useCallback((entry: CacheEntry<T>) => {
    return Date.now() < entry.expiresAt
  }, [])
  
  // Get from cache or fetch
  const fetchWithCache = useCallback(async () => {
    const localCached = cacheRef.current.get(key)
    if (localCached && isValidCache(localCached)) {
      setData(localCached.data)
      return localCached.data
    }

    const globalCached = globalCache.get(key) as CacheEntry<T> | undefined
    if (globalCached && isValidCache(globalCached)) {
      cacheRef.current.set(key, globalCached)
      setData(globalCached.data)
      return globalCached.data
    }

    const localPending = pendingRef.current.get(key)
    if (localPending) {
      setLoading(true)
      try {
        const result = await localPending
        setData(result)
        return result
      } catch (err) {
        setError(err as Error)
        throw err
      } finally {
        setLoading(false)
      }
    }

    const globalPending = globalPendingRequests.get(key) as Promise<T> | undefined
    if (globalPending) {
      pendingRef.current.set(key, globalPending)
      setLoading(true)
      try {
        const result = await globalPending
        setData(result)
        return result
      } catch (err) {
        setError(err as Error)
        throw err
      } finally {
        setLoading(false)
      }
    }

    // Fetch new data
    setLoading(true)
    setError(null)
    
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
      return result
    })()

    pendingRef.current.set(key, loadPromise)
    globalPendingRequests.set(key, loadPromise)

    try {
      const result = await loadPromise
      setData(result)
      return result
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
      pendingRef.current.delete(key)
      globalPendingRequests.delete(key)
    }
  }, [key, fetcher, ttl, isValidCache])
  
  // Optimistic update function
  const updateOptimistically = useCallback((updater: (current: T | null) => T) => {
    if (!optimisticUpdate) return
    
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
  }, [data, key, ttl, optimisticUpdate])
  
  // Invalidate cache entry
  const invalidate = useCallback(() => {
    cacheRef.current.delete(key)
    globalCache.delete(key)
    pendingRef.current.delete(key)
    globalPendingRequests.delete(key)
  }, [key])
  
  // Refetch data (bypassing cache)
  const refetch = useCallback(async () => {
    invalidate()
    return fetchWithCache()
  }, [invalidate, fetchWithCache])
  
  // Initial fetch
  useEffect(() => {
    if (prefetch || data === null) {
      fetchWithCache()
    }
  }, [prefetch, data, fetchWithCache])
  
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
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await fetcher()
      
      // Update global cache
      globalCache.set(key, {
        data: result,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl
      })
      
      setData(result)
      return result
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [key, fetcher, ttl])
  
  const invalidate = useCallback(() => {
    globalCache.delete(key)
  }, [key])
  
  const refetch = useCallback(() => {
    return fetchData(true)
  }, [fetchData])
  
  // Subscribe to cache updates from other components
  useEffect(() => {
    const checkCache = () => {
      const cached = globalCache.get(key)
      if (cached && Date.now() < cached.expiresAt) {
        setData(cached.data)
      }
    }
    
    // Check periodically for updates
    const interval = setInterval(checkCache, 1000)
    return () => clearInterval(interval)
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
