import { useCallback, useEffect, useRef } from 'react'
import * as Sentry from '@sentry/nextjs'

interface PerformanceMetrics {
  operationName: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
  completed?: boolean
}

const SLOW_OPERATION_THRESHOLD_MS = 1000

export function usePerformanceMonitor(operationName: string, metadata?: Record<string, any>) {
  const metricsRef = useRef<PerformanceMetrics>({
    operationName,
    startTime: performance.now(),
    metadata,
    completed: false
  })

  useEffect(() => {
    // Start tracking when component mounts
    const startTime = performance.now()
    metricsRef.current = {
      operationName,
      startTime,
      metadata,
      completed: false
    }

    return () => {
      if (metricsRef.current.completed) {
        return
      }

      // Track when component unmounts
      const endTime = performance.now()
      const duration = endTime - startTime

      const finalMetadata = metricsRef.current.metadata ?? {}

      metricsRef.current = {
        ...metricsRef.current,
        endTime,
        duration,
        completed: true
      }

      // Track cleanup without completion for visibility
      Sentry.addBreadcrumb({
        message: `Performance cleanup: ${operationName}`,
        level: 'info',
        data: {
          duration,
          ...finalMetadata
        }
      })
    }
  }, [operationName, metadata])

  const markComplete = useCallback((additionalMetadata?: Record<string, any>) => {
    const endTime = performance.now()
    const duration = endTime - metricsRef.current.startTime

    const mergedMetadata = {
      ...(metricsRef.current.metadata ?? {}),
      ...(additionalMetadata ?? {})
    }

    const finalMetrics = {
      ...metricsRef.current,
      endTime,
      duration,
      metadata: mergedMetadata,
      completed: true
    }

    metricsRef.current = finalMetrics

    if (duration > SLOW_OPERATION_THRESHOLD_MS) {
      console.warn(`Slow operation detected: ${operationName} took ${duration.toFixed(2)}ms`)

      Sentry.addBreadcrumb({
        message: `Slow operation: ${operationName}`,
        level: 'warning',
        data: {
          duration,
          ...mergedMetadata
        }
      })

      return finalMetrics
    }

    // Track in Sentry
    Sentry.addBreadcrumb({
      message: `Operation completed: ${operationName}`,
      level: 'info',
      data: finalMetrics
    })

    return finalMetrics
  }, [operationName])

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
      metadata,
      completed: true
    }

    // Log slow operations
    if (duration > SLOW_OPERATION_THRESHOLD_MS) {
      console.warn(`Slow async operation: ${operationName} took ${duration.toFixed(2)}ms`)
    }

    // Track in Sentry
    Sentry.addBreadcrumb({
      message: `Async operation: ${operationName}`,
      level: duration > SLOW_OPERATION_THRESHOLD_MS ? 'warning' : 'info',
      data: { duration, ...(metadata ?? {}) }
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
