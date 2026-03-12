"use client";

import { useState, useEffect, useMemo } from "react";
import { startOfMonth, endOfMonth } from "date-fns";
import { DragDropContext } from "@hello-pangea/dnd";
import { TasksProvider } from "@/contexts/tasks-context";
import { useBuckets } from "@/hooks/use-buckets";
import { useTaskData, useTaskActions } from "@/contexts/tasks-context";
import { CalendarPerformanceMonitor, useComponentLoadTime } from "@/features/calendar/components/calendar-performance-monitor";
import { useDragDropHandler } from "@/features/calendar/hooks/use-drag-drop-handler";
import { toDayKey } from "@/features/calendar/types";
import { prefetchToGlobalCache } from "@/hooks/use-data-cache";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

// Direct imports — no inner lazy loading. This module is already behind a
// dynamic() import in page.tsx. Adding React.lazy here would create a
// waterfall: page chunk → this chunk → FullCalendar chunk → API fetches.
import FullCalendar from "@/features/calendar/components/full-calendar";
import { CalendarTaskList } from "@/features/calendar/components/calendar-task-list";

// ── Prefetch calendar data at module load time ──────────────────────────
// These fire as soon as the JS chunk evaluates, overlapping with React
// hydration rather than waiting until useQuery mounts inside the component tree.

prefetchToGlobalCache('uploaded-calendar-events-0', async () => {
  try {
    const resp = await fetchWithTimeout('/api/calendar/upload', { cache: 'no-store' });
    if (!resp.ok) return [];
    const payload = await resp.json();
    return Array.isArray(payload.events) ? payload.events : [];
  } catch {
    return [];
  }
});

prefetchToGlobalCache('cycle-tracking-calendar', async () => {
  try {
    const resp = await fetchWithTimeout('/api/widgets/cycle-tracking?limit=90', { cache: 'no-store' });
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data?.entries) ? data.entries : [];
  } catch {
    return [];
  }
});

// Prefetch Google Calendar events for the current month
{
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const startKey = toDayKey(monthStart);
  const endKey = toDayKey(monthEnd);

  prefetchToGlobalCache(`calendar-google-month-${startKey}-${endKey}`, async () => {
    try {
      const params = new URLSearchParams({
        timeMin: monthStart.toISOString(),
        timeMax: monthEnd.toISOString(),
        maxResults: '500',
      });
      const resp = await fetchWithTimeout(
        `/api/integrations/google/calendar/events?${params.toString()}`
      );
      if (!resp.ok) return [];
      const payload = await resp.json();
      return Array.isArray(payload.events) ? payload.events : [];
    } catch {
      return [];
    }
  });
}

interface CalendarContentProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

function CalendarContent({ selectedDate, onDateChange }: CalendarContentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { buckets, activeBucket } = useBuckets();
  const { allTasks } = useTaskData();
  const { batchUpdateTasks } = useTaskActions();
  const selectedDateStr = useMemo(() => toDayKey(selectedDate), [selectedDate]);
  useComponentLoadTime('CalendarContent');

  // Hide sidebar on mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    update(mq);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const handleDragEnd = useDragDropHandler({
    selectedDateStr,
    selectedDate,
    allTasks,
    batchUpdateTasks,
    setIsDragging,
  });

  return (
    <DragDropContext
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full">
        {/* Main calendar area */}
        <div className={`flex-1 min-w-0 min-h-0 transition-[margin] duration-300 ${isSidebarCollapsed ? 'lg:mr-0' : ''}`}>
          <FullCalendar
            selectedDate={selectedDate}
            onDateChange={onDateChange}
            availableBuckets={buckets}
            selectedBucket={activeBucket}
            isDragging={isDragging}
          />
        </div>

        {/* Task list sidebar — hidden on mobile */}
        {!isMobile && (
          <div
            className={`flex-shrink-0 w-full transition-[width] duration-300 ease-in-out ${
              isSidebarCollapsed ? 'lg:w-[64px]' : 'lg:w-[360px]'
            }`}
          >
            <CalendarTaskList
              selectedDate={selectedDate}
              onDateChange={onDateChange}
              availableBuckets={buckets}
              selectedBucket={activeBucket}
              isDragging={isDragging}
              onCollapsedChange={setIsSidebarCollapsed}
              onTaskClick={(taskId, dateStr) => {
                window.dispatchEvent(new CustomEvent('lifeboard:task-click', {
                  detail: { taskId, dateStr }
                }));
              }}
            />
          </div>
        )}
      </div>
    </DragDropContext>
  );
}

export default function OptimizedCalendarView() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <TasksProvider selectedDate={selectedDate}>
      <CalendarContent selectedDate={selectedDate} onDateChange={setSelectedDate} />
      {process.env.NODE_ENV === 'development' && <CalendarPerformanceMonitor />}
    </TasksProvider>
  );
}
