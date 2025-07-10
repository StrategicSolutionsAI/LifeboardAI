"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { getUserPreferencesClient, saveUserPreferences } from '@/lib/user-preferences'
import { supabase } from '@/utils/supabase/client'

interface InstantDataOptions {
  key: string
  fetcher: () => Promise<any>
  ttl?: number // Time to live in milliseconds
  prefetch?: boolean
  onProgress?: (progress: number) => void
}

// Local storage with versioning and expiry
class LocalCache {
  private version = '1.0.0'
  
  get(key: string): any {
    try {
      const item = localStorage.getItem(`lifeboard_${key}`)
      if (!item) return null
      
      const { data, expiry, version } = JSON.parse(item)
      
      // Check version and expiry
      if (version !== this.version || (expiry && Date.now() > expiry)) {
        this.remove(key)
        return null
      }
      
      return data
    } catch {
      return null
    }
  }
  
  set(key: string, data: any, ttl?: number) {
    try {
      const item = {
        data,
        version: this.version,
        expiry: ttl ? Date.now() + ttl : null,
        timestamp: Date.now()
      }
      localStorage.setItem(`lifeboard_${key}`, JSON.stringify(item))
    } catch (e) {
      // Handle quota exceeded
      console.warn('LocalStorage quota exceeded, clearing old data')
      this.clearOldData()
    }
  }
  
  remove(key: string) {
    localStorage.removeItem(`lifeboard_${key}`)
  }
  
  clearOldData() {
    const keys = Object.keys(localStorage)
    const items: Array<{ key: string; timestamp: number }> = []
    
    keys.forEach(key => {
      if (key.startsWith('lifeboard_')) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '{}')
          items.push({ key, timestamp: item.timestamp || 0 })
        } catch {}
      }
    })
    
    // Remove oldest 25% of items
    items.sort((a, b) => a.timestamp - b.timestamp)
    const toRemove = Math.floor(items.length * 0.25)
    items.slice(0, toRemove).forEach(item => localStorage.removeItem(item.key))
  }
}

const localCache = new LocalCache()

// Global prefetch queue
const prefetchQueue = new Set<string>()
const prefetchInProgress = new Map<string, Promise<any>>()

export function useInstantData<T>({
  key,
  fetcher,
  ttl = 5 * 60 * 1000, // 5 minutes default
  prefetch = true,
  onProgress
}: InstantDataOptions) {
  const [data, setData] = useState<T | null>(() => {
    // Try to get from local storage first for instant render
    return localCache.get(key)
  })
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState<Error | null>(null)
  const [isStale, setIsStale] = useState(false)
  const fetchedRef = useRef(false)
  
  // Prefetch adjacent data
  const prefetchRelated = useCallback(() => {
    if (!prefetch) return
    
    // Example: If loading bucket data, prefetch widgets for that bucket
    if (key.startsWith('bucket_')) {
      const bucketId = key.replace('bucket_', '')
      prefetchData(`widgets_${bucketId}`, async () => {
        // Fetch widgets for this bucket
        const { data } = await supabase
          .from('user_preferences')
          .select('widgets')
          .single()
        return data?.widgets?.[bucketId] || []
      })
    }
  }, [key, prefetch])
  
  const fetchData = useCallback(async () => {
    try {
      // Report initial progress
      onProgress?.(10)
      
      // Check if already fetching
      if (prefetchInProgress.has(key)) {
        const result = await prefetchInProgress.get(key)
        setData(result)
        setLoading(false)
        onProgress?.(100)
        return result
      }
      
      // Start fetching
      const promise = fetcher()
      prefetchInProgress.set(key, promise)
      
      onProgress?.(30)
      
      const result = await promise
      
      onProgress?.(80)
      
      // Update state
      setData(result)
      setError(null)
      setIsStale(false)
      
      // Cache the result
      localCache.set(key, result, ttl)
      
      onProgress?.(100)
      
      // Prefetch related data
      prefetchRelated()
      
      return result
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
      prefetchInProgress.delete(key)
    }
  }, [key, fetcher, ttl, onProgress, prefetchRelated])
  
  // Initial fetch
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      
      // If we have cached data, mark as stale and fetch in background
      if (data) {
        setIsStale(true)
        setLoading(false)
        // Fetch fresh data in background
        fetchData().catch(console.error)
      } else {
        // No cached data, fetch immediately
        fetchData()
      }
    }
  }, [])
  
  const refetch = useCallback(() => {
    setLoading(true)
    return fetchData()
  }, [fetchData])
  
  return {
    data,
    loading,
    error,
    isStale,
    refetch
  }
}

// Prefetch data before it's needed
export async function prefetchData(key: string, fetcher: () => Promise<any>, ttl?: number) {
  // Check if already cached
  const cached = localCache.get(key)
  if (cached) return cached
  
  // Check if already prefetching
  if (prefetchInProgress.has(key)) {
    return prefetchInProgress.get(key)
  }
  
  // Add to queue
  prefetchQueue.add(key)
  
  try {
    const promise = fetcher()
    prefetchInProgress.set(key, promise)
    
    const result = await promise
    localCache.set(key, result, ttl)
    
    return result
  } finally {
    prefetchQueue.delete(key)
    prefetchInProgress.delete(key)
  }
}

// Hook for user preferences with instant loading
export function useInstantPreferences() {
  return useInstantData({
    key: 'user_preferences',
    fetcher: getUserPreferencesClient,
    ttl: 10 * 60 * 1000, // 10 minutes
    prefetch: true
  })
}

// Hook for widgets with instant loading
export function useInstantWidgets(bucketId: string) {
  return useInstantData({
    key: `widgets_${bucketId}`,
    fetcher: async () => {
      const prefs = await getUserPreferencesClient()
      return prefs?.widgets?.[bucketId] || []
    },
    ttl: 5 * 60 * 1000,
    prefetch: true
  })
}

// Hook for integration status with instant loading
export function useInstantIntegrations() {
  return useInstantData({
    key: 'integrations',
    fetcher: async () => {
      const providers = ['fitbit', 'googlefit', 'apple_health']
      const statuses = await Promise.all(
        providers.map(async (provider) => {
          try {
            const res = await fetch(`/api/integrations/status?provider=${provider}`)
            const data = await res.json()
            return { provider, ...data }
          } catch {
            return { provider, connected: false }
          }
        })
      )
      return statuses
    },
    ttl: 30 * 60 * 1000, // 30 minutes
    prefetch: false // Don't prefetch integrations
  })
}

// Preload critical data on app start
export function preloadDashboardData() {
  // Prefetch user preferences
  prefetchData('user_preferences', getUserPreferencesClient)
  
  // Prefetch first bucket's widgets
  getUserPreferencesClient().then(prefs => {
    if (prefs?.life_buckets?.[0]) {
      const firstBucket = prefs.life_buckets[0]
      prefetchData(`widgets_${firstBucket.id}`, async () => {
        return prefs.widgets?.[firstBucket.id] || []
      })
    }
  })
}
