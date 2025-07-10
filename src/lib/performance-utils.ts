// Performance utilities for optimizing React components

import { useRef, useCallback } from 'react'

/**
 * Custom hook for RAF-based throttling
 * Ensures updates happen at most once per frame (60fps)
 */
export function useRAFThrottle<T extends (...args: any[]) => any>(
  callback: T,
  dependencies: React.DependencyList = []
): T {
  const rafRef = useRef<number | null>(null)
  
  const throttledCallback = useCallback((...args: Parameters<T>) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }
    
    rafRef.current = requestAnimationFrame(() => {
      callback(...args)
      rafRef.current = null
    })
  }, dependencies) as T
  
  return throttledCallback
}

/**
 * Custom hook for intersection observer
 * Useful for lazy loading components when they come into viewport
 */
export function useInView(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isInView, setIsInView] = React.useState(false)
  
  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    
    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting)
    }, options)
    
    observer.observe(element)
    
    return () => {
      observer.disconnect()
    }
  }, [ref, options.root, options.rootMargin, options.threshold])
  
  return isInView
}

/**
 * Batch state updates to reduce re-renders
 */
export function batchUpdates<T>(
  updates: Array<() => void>
): void {
  // React 18 automatically batches updates, but this ensures compatibility
  if ('startTransition' in React) {
    React.startTransition(() => {
      updates.forEach(update => update())
    })
  } else {
    updates.forEach(update => update())
  }
}

/**
 * Virtual scrolling helper for large lists
 */
export interface VirtualItem {
  index: number
  start: number
  end: number
  size: number
}

export function useVirtualScroll(
  itemCount: number,
  itemSize: number | ((index: number) => number),
  containerHeight: number,
  scrollTop: number,
  overscan = 3
) {
  const items = React.useMemo(() => {
    const visibleItems: VirtualItem[] = []
    let accumulatedHeight = 0
    
    for (let i = 0; i < itemCount; i++) {
      const size = typeof itemSize === 'function' ? itemSize(i) : itemSize
      const start = accumulatedHeight
      const end = accumulatedHeight + size
      
      // Check if item is visible (with overscan)
      if (end >= scrollTop - overscan * size && start <= scrollTop + containerHeight + overscan * size) {
        visibleItems.push({
          index: i,
          start,
          end,
          size
        })
      }
      
      accumulatedHeight = end
    }
    
    return visibleItems
  }, [itemCount, itemSize, containerHeight, scrollTop, overscan])
  
  const totalHeight = React.useMemo(() => {
    let height = 0
    for (let i = 0; i < itemCount; i++) {
      height += typeof itemSize === 'function' ? itemSize(i) : itemSize
    }
    return height
  }, [itemCount, itemSize])
  
  return {
    items,
    totalHeight
  }
}

/**
 * Prefetch data when idle
 */
export function usePrefetch(
  fetcher: () => Promise<void>,
  dependencies: React.DependencyList = []
) {
  React.useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(() => {
        fetcher()
      })
      
      return () => cancelIdleCallback(id)
    } else {
      // Fallback for browsers without requestIdleCallback
      const timeout = setTimeout(fetcher, 100)
      return () => clearTimeout(timeout)
    }
  }, dependencies)
}

// Import React for the utilities
import * as React from 'react'
