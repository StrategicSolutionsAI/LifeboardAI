"use client";

import { useEffect, useState } from 'react';

interface PerformanceMetrics {
  firstContentfulPaint: number;
  domInteractive: number;
  loadComplete: number;
  apiCallsCount: number;
  cacheHitRate: number;
}

export function CalendarPerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') return;
    
    // Track performance metrics
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const paintEntry = entries.find(entry => entry.name === 'first-contentful-paint');
      
      if (paintEntry) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        setMetrics({
          firstContentfulPaint: Math.round(paintEntry.startTime),
          domInteractive: Math.round(navigation.domInteractive),
          loadComplete: Math.round(navigation.loadEventEnd),
          apiCallsCount: 0,
          cacheHitRate: 0
        });
      }
    });
    
    observer.observe({ entryTypes: ['paint', 'navigation'] });
    
    // Track API calls
    let apiCallCount = 0;
    let cacheHits = 0;
    let totalCalls = 0;
    
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [url] = args;
      const urlString = typeof url === 'string' ? url : url.toString();
      
      // Track API calls to our endpoints
      if (urlString.includes('/api/')) {
        totalCalls++;
        
        // Check if response is from cache (simplified check)
        const response = await originalFetch(...args);
        const cacheHeader = response.headers.get('x-cache');
        if (cacheHeader === 'HIT') {
          cacheHits++;
        }
        
        setMetrics(prev => prev ? {
          ...prev,
          apiCallsCount: totalCalls,
          cacheHitRate: totalCalls > 0 ? Math.round((cacheHits / totalCalls) * 100) : 0
        } : null);
        
        return response;
      }
      
      return originalFetch(...args);
    };
    
    // Cleanup
    return () => {
      window.fetch = originalFetch;
      observer.disconnect();
    };
  }, []);
  
  // Toggle with keyboard shortcut (Ctrl+Shift+P)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
  
  if (!isVisible || !metrics) return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg shadow-lg z-50 font-mono text-xs">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold">Performance Metrics</h3>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-theme-text-tertiary hover:text-white"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-theme-text-tertiary">FCP:</span>
          <span className={metrics.firstContentfulPaint < 1000 ? 'text-green-400' : metrics.firstContentfulPaint < 2000 ? 'text-yellow-400' : 'text-red-400'}>
            {metrics.firstContentfulPaint}ms
          </span>
        </div>
        
        <div className="flex justify-between gap-4">
          <span className="text-theme-text-tertiary">DOM Interactive:</span>
          <span className={metrics.domInteractive < 2000 ? 'text-green-400' : metrics.domInteractive < 3000 ? 'text-yellow-400' : 'text-red-400'}>
            {metrics.domInteractive}ms
          </span>
        </div>
        
        <div className="flex justify-between gap-4">
          <span className="text-theme-text-tertiary">Load Complete:</span>
          <span className={metrics.loadComplete < 3000 ? 'text-green-400' : metrics.loadComplete < 5000 ? 'text-yellow-400' : 'text-red-400'}>
            {metrics.loadComplete}ms
          </span>
        </div>
        
        <div className="flex justify-between gap-4">
          <span className="text-theme-text-tertiary">API Calls:</span>
          <span className={metrics.apiCallsCount < 5 ? 'text-green-400' : metrics.apiCallsCount < 10 ? 'text-yellow-400' : 'text-red-400'}>
            {metrics.apiCallsCount}
          </span>
        </div>
        
        <div className="flex justify-between gap-4">
          <span className="text-theme-text-tertiary">Cache Hit Rate:</span>
          <span className={metrics.cacheHitRate > 80 ? 'text-green-400' : metrics.cacheHitRate > 50 ? 'text-yellow-400' : 'text-red-400'}>
            {metrics.cacheHitRate}%
          </span>
        </div>
      </div>
      
      <div className="mt-2 pt-2 border-t border-theme-text-body text-[10px] text-theme-text-tertiary">
        Press Ctrl+Shift+P to toggle
      </div>
    </div>
  );
}

// Hook to track specific component load times
export function useComponentLoadTime(componentName: string) {
  const [loadTime, setLoadTime] = useState<number | null>(null);
  
  useEffect(() => {
    const startTime = performance.now();
    
    // Use RAF to measure after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        setLoadTime(duration);
        
        // Log to console in development
      });
    });
  }, [componentName]);
  
  return loadTime;
}
