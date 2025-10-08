import { useEffect, useRef } from 'react'
import * as Sentry from '@sentry/nextjs'

interface PerformanceMetrics {
  operationName: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
}

export function usePerformanceMonitor(operationName: string, metadata?: Record<string, any>) {
  const metricsRef = useRef<PerformanceMetrics>({
    operationName,
    startTime: performance.now(),
    metadata
  })

  useEffect(() => {
    // Start tracking when component mounts
    const startTime = performance.now()
    metricsRef.current.startTime = startTime

    return () => {
      // Track when component unmounts
      const endTime = performance.now()
      const duration = endTime - startTime

      metricsRef.current.endTime = endTime
      metricsRef.current.duration = duration

      // Log slow operations (> 1 second)
      if (duration > 1000) {
        console.warn(`Slow operation detected: ${operationName} took ${duration.toFixed(2)}ms`)

        // Send to Sentry
        Sentry.addBreadcrumb({
          message: `Slow operation: ${operationName}`,
          level: 'warning',
          data: {
            duration: duration,
            ...metadata
          }
        })
      }

      // Track performance metrics
      Sentry.addBreadcrumb({
        message: `Performance: ${operationName}`,
        level: 'info',
        data: {
          duration: duration,
          ...metadata
        }
      })
    }
  }, [operationName, metadata])

  const markComplete = (additionalMetadata?: Record<string, any>) => {
    const endTime = performance.now()
    const duration = endTime - metricsRef.current.startTime
    
    const finalMetrics = {
      ...metricsRef.current,
      endTime,
      duration,
      metadata: { ...metadata, ...additionalMetadata }
    }

    // Track in Sentry
    Sentry.addBreadcrumb({
      message: `Operation completed: ${operationName}`,
      level: 'info',
      data: finalMetrics
    })

    return finalMetrics
  }

  return { markComplete, metrics: metricsRef.current }
}

// Utility for measuring async operations
export async function measureAsync<T>(
  operationName: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<{ result: T; metrics: PerformanceMetrics }> {
  const startTime = performance.now()
  
  try {
    const result = await operation()
    const endTime = performance.now()
    const duration = endTime - startTime

    const metrics: PerformanceMetrics = {
      operationName,
      startTime,
      endTime,
      duration,
      metadata
    }

    // Log slow operations
    if (duration > 1000) {
      console.warn(`Slow async operation: ${operationName} took ${duration.toFixed(2)}ms`)
    }

    // Track in Sentry
    Sentry.addBreadcrumb({
      message: `Async operation: ${operationName}`,
      level: duration > 1000 ? 'warning' : 'info',
      data: { duration, ...metadata }
    })

    return { result, metrics }
  } catch (error) {
    const endTime = performance.now()
    const duration = endTime - startTime

    // Track failed operation
    Sentry.withScope((scope) => {
      scope.setTag('operationType', 'async')
      scope.setContext('performance', {
        operationName,
        duration,
        metadata
      })
      Sentry.captureException(error)
    })

    throw error
  }
}
