import { useCallback, useEffect, useRef } from 'react'

interface PerformanceMetrics {
  operationName: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
  completed?: boolean
}

const SLOW_OPERATION_THRESHOLD_MS = 1000

// Lazy-loaded Sentry reference — avoids pulling ~1000 modules into the main bundle
let _sentry: Promise<typeof import('@sentry/nextjs')> | null = null
function getSentry() {
  if (!_sentry) {
    _sentry = import('@sentry/nextjs')
  }
  return _sentry
}

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
      getSentry().then(Sentry => {
        Sentry.addBreadcrumb({
          message: `Performance cleanup: ${operationName}`,
          level: 'info',
          data: {
            duration,
            ...finalMetadata
          }
        })
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

      getSentry().then(Sentry => {
        Sentry.addBreadcrumb({
          message: `Slow operation: ${operationName}`,
          level: 'warning',
          data: {
            duration,
            ...mergedMetadata
          }
        })
      })

      return finalMetrics
    }

    // Track in Sentry
    getSentry().then(Sentry => {
      Sentry.addBreadcrumb({
        message: `Operation completed: ${operationName}`,
        level: 'info',
        data: finalMetrics
      })
    })

    return finalMetrics
  }, [operationName])

  return { markComplete, metrics: metricsRef.current }
}

