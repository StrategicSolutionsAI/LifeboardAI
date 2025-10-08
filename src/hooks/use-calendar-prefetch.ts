import { useCallback, useRef } from 'react';
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from 'date-fns';

/**
 * Hook to prefetch calendar data for better navigation performance
 */
export function useCalendarPrefetch() {
  const prefetchCache = useRef<Set<string>>(new Set());
  const prefetchTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  /**
   * Prefetch data for a specific date
   */
  const prefetchDate = useCallback(async (date: Date, delay = 100) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const cacheKey = `prefetch-${dateStr}`;
    
    // Skip if already prefetched
    if (prefetchCache.current.has(cacheKey)) {
      return;
    }
    
    // Clear existing timeout for this date
    const existingTimeout = prefetchTimeouts.current.get(cacheKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Schedule prefetch with delay
    const timeout = setTimeout(async () => {
      try {
        // Mark as prefetched
        prefetchCache.current.add(cacheKey);
        
        // Prefetch tasks and events in parallel
        await Promise.all([
          fetch(`/api/integrations/todoist/tasks?date=${dateStr}`, {
            method: 'GET',
            credentials: 'same-origin',
            // Use low priority for prefetch
            headers: { 'Priority': 'low' }
          }),
          fetch(`/api/integrations/google/calendar/events?date=${dateStr}`, {
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'Priority': 'low' }
          })
        ]);
        
      } catch (error) {
        // Remove from cache on error so it can be retried
        prefetchCache.current.delete(cacheKey);
        console.warn(`Failed to prefetch ${dateStr}:`, error);
      } finally {
        prefetchTimeouts.current.delete(cacheKey);
      }
    }, delay);
    
    prefetchTimeouts.current.set(cacheKey, timeout);
  }, []);
  
  /**
   * Prefetch adjacent dates when hovering on navigation
   */
  const prefetchAdjacentDates = useCallback((currentDate: Date, direction: 'prev' | 'next', view: 'day' | 'week' | 'month') => {
    const dates: Date[] = [];
    
    switch (view) {
      case 'day':
        if (direction === 'prev') {
          dates.push(subDays(currentDate, 1));
          dates.push(subDays(currentDate, 2)); // Prefetch 2 days ahead
        } else {
          dates.push(addDays(currentDate, 1));
          dates.push(addDays(currentDate, 2));
        }
        break;
        
      case 'week':
        if (direction === 'prev') {
          // Prefetch previous week's dates
          for (let i = 1; i <= 7; i++) {
            dates.push(subDays(currentDate, i));
          }
        } else {
          // Prefetch next week's dates
          for (let i = 1; i <= 7; i++) {
            dates.push(addDays(currentDate, i));
          }
        }
        break;
        
      case 'month':
        if (direction === 'prev') {
          // Prefetch key dates from previous month
          const prevMonth = subMonths(currentDate, 1);
          dates.push(prevMonth);
          dates.push(addDays(prevMonth, 7));
          dates.push(addDays(prevMonth, 14));
          dates.push(addDays(prevMonth, 21));
        } else {
          // Prefetch key dates from next month
          const nextMonth = addMonths(currentDate, 1);
          dates.push(nextMonth);
          dates.push(addDays(nextMonth, 7));
          dates.push(addDays(nextMonth, 14));
          dates.push(addDays(nextMonth, 21));
        }
        break;
    }
    
    // Stagger prefetch requests to avoid overloading
    dates.forEach((date, index) => {
      prefetchDate(date, 100 + (index * 50));
    });
  }, [prefetchDate]);
  
  /**
   * Prefetch for view change
   */
  const prefetchViewChange = useCallback((currentDate: Date, newView: 'day' | 'week' | 'month') => {
    const dates: Date[] = [];
    
    switch (newView) {
      case 'day':
        // Just prefetch current date
        dates.push(currentDate);
        break;
        
      case 'week':
        // Prefetch current week
        for (let i = -3; i <= 3; i++) {
          dates.push(addDays(currentDate, i));
        }
        break;
        
      case 'month':
        // Prefetch key dates in current month
        dates.push(currentDate);
        dates.push(addDays(currentDate, -7));
        dates.push(addDays(currentDate, 7));
        dates.push(addDays(currentDate, 14));
        break;
    }
    
    dates.forEach((date, index) => {
      prefetchDate(date, 50 + (index * 30));
    });
  }, [prefetchDate]);
  
  /**
   * Clear prefetch cache (useful when user changes or data is updated)
   */
  const clearPrefetchCache = useCallback(() => {
    // Clear all pending timeouts
    prefetchTimeouts.current.forEach(timeout => clearTimeout(timeout));
    prefetchTimeouts.current.clear();
    
    // Clear cache
    prefetchCache.current.clear();
  }, []);
  
  return {
    prefetchDate,
    prefetchAdjacentDates,
    prefetchViewChange,
    clearPrefetchCache
  };
}
