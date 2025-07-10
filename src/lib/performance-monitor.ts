// Performance monitoring utilities for measuring load times and interactions

interface PerformanceMetric {
  name: string
  startTime: number
  endTime?: number
  duration?: number
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map()
  private enabled = process.env.NODE_ENV === 'development'
  
  start(name: string) {
    if (!this.enabled) return
    
    this.metrics.set(name, {
      name,
      startTime: performance.now()
    })
  }
  
  end(name: string) {
    if (!this.enabled) return
    
    const metric = this.metrics.get(name)
    if (!metric) {
      console.warn(`Performance metric "${name}" was not started`)
      return
    }
    
    metric.endTime = performance.now()
    metric.duration = metric.endTime - metric.startTime
    
    // Log to console in development
    console.log(`⚡ ${name}: ${metric.duration.toFixed(2)}ms`)
    
    // You could also send this to an analytics service
    this.sendToAnalytics(metric)
  }
  
  measure(name: string, fn: () => void | Promise<void>) {
    this.start(name)
    const result = fn()
    
    if (result instanceof Promise) {
      return result.finally(() => this.end(name))
    } else {
      this.end(name)
      return result
    }
  }
  
  private sendToAnalytics(metric: PerformanceMetric) {
    // Placeholder for sending metrics to analytics service
    // Example: send to Google Analytics, Vercel Analytics, etc.
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'timing_complete', {
        name: metric.name,
        value: Math.round(metric.duration || 0),
        event_category: 'Performance'
      })
    }
  }
  
  getMetrics() {
    return Array.from(this.metrics.values())
      .filter(m => m.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
  }
  
  logSummary() {
    if (!this.enabled) return
    
    const metrics = this.getMetrics()
    if (metrics.length === 0) return
    
    console.group('🎯 Performance Summary')
    console.table(
      metrics.map(m => ({
        'Operation': m.name,
        'Duration (ms)': m.duration?.toFixed(2),
        'Category': m.name.includes('fetch') ? 'Network' : 
                   m.name.includes('render') ? 'Rendering' : 'Other'
      }))
    )
    console.groupEnd()
  }
  
  reset() {
    this.metrics.clear()
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor()

// React hook for component performance monitoring
export function usePerformanceMonitor(componentName: string) {
  React.useEffect(() => {
    performanceMonitor.start(`${componentName}_mount`)
    
    return () => {
      performanceMonitor.end(`${componentName}_mount`)
    }
  }, [componentName])
}

// HOC for monitoring component performance
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return React.forwardRef<any, P>((props, ref) => {
    usePerformanceMonitor(componentName)
    return <Component {...props} ref={ref} />
  })
}

// Utility to monitor async operations
export async function monitorAsync<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  performanceMonitor.start(name)
  try {
    const result = await operation()
    performanceMonitor.end(name)
    return result
  } catch (error) {
    performanceMonitor.end(name)
    throw error
  }
}

// Web Vitals monitoring
export function reportWebVitals(metric: any) {
  const { name, value } = metric
  
  // Log to console
  console.log(`📊 ${name}: ${value.toFixed(2)}`)
  
  // Send to analytics
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, {
      value: Math.round(value),
      event_category: 'Web Vitals',
      non_interaction: true
    })
  }
}

// Import React
import * as React from 'react'

// Extend window type for gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}
