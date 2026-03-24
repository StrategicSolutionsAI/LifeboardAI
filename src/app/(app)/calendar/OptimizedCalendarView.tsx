"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { startOfMonth, endOfMonth } from "date-fns";
import { DragDropContext } from "@hello-pangea/dnd";
import { TasksProvider } from "@/contexts/tasks-context";
import { useBuckets } from "@/hooks/use-buckets";
import { useTaskData, useTaskActions } from "@/contexts/tasks-context";
import { useWidgets } from "@/hooks/use-widgets";
import { useToast } from "@/components/ui/use-toast";
import { CalendarPerformanceMonitor, useComponentLoadTime } from "@/features/calendar/components/calendar-performance-monitor";
import { useDragDropHandler, type HabitDropPayload } from "@/features/calendar/hooks/use-drag-drop-handler";
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
  const { batchUpdateTasks, createTask } = useTaskActions();
  const { widgetsByBucket } = useWidgets();
  const { toast } = useToast();
  const selectedDateStr = useMemo(() => toDayKey(selectedDate), [selectedDate]);
  useComponentLoadTime('CalendarContent');

  // Ref instead of state — avoids recreating handleHabitDrop (and thus
  // handleDragEnd) mid-drag, which destabilises @hello-pangea/dnd.
  const creatingHabitRef = useRef(false);

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

  // ── Habit drop handler — creates a one-time all-day task (no dialog, no linking) ──
  const handleHabitDrop = useCallback(
    (payload: HabitDropPayload) => {
      if (creatingHabitRef.current) return;

      const widgets = widgetsByBucket[payload.bucketName] ?? [];
      const widget = widgets.find((w) => w.instanceId === payload.instanceId);
      if (!widget) return;

      const habitName = widget.habitTrackerData?.habitName ?? widget.name ?? "Habit";

      creatingHabitRef.current = true;
      createTask(habitName, payload.targetDate, null, payload.bucketName, "none", { allDay: true })
        .then(() => {
          toast({ title: "Task created", description: `"${habitName}" added to ${payload.targetDate}.` });
        })
        .catch((err: unknown) => {
          console.error("Failed to create habit task:", err);
          toast({ title: "Failed to create task", description: "Please try again." });
        })
        .finally(() => {
          creatingHabitRef.current = false;
        });
    },
    [widgetsByBucket, createTask, toast],
  );

  const handleDragEnd = useDragDropHandler({
    selectedDateStr,
    selectedDate,
    allTasks,
    batchUpdateTasks,
    setIsDragging,
    onHabitDrop: handleHabitDrop,
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

/** Error boundary that retries up to MAX_RETRIES on DnD context errors.
 *  React 18 concurrent rendering can cause @hello-pangea/dnd invariant
 *  failures during recoverFromConcurrentError — a retry resolves it.
 *  Uses an incrementing key to force a full subtree remount on each retry. */
class DnDErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; retryKey: number }
> {
  static MAX_RETRIES = 3;
  state = { hasError: false, retryKey: 0 };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (
      error.message?.includes('Could not find required context') &&
      this.state.retryKey < DnDErrorBoundary.MAX_RETRIES
    ) {
      // Increasing delay on each retry so context has time to settle
      const delay = 100 * (this.state.retryKey + 1);
      setTimeout(() => {
        this.setState(prev => ({
          hasError: false,
          retryKey: prev.retryKey + 1,
        }));
      }, delay);
    }
    // If retries exhausted, stay in hasError = true → render null
    // Prevents infinite loop that crashes the page via the app error boundary
  }

  render() {
    if (this.state.hasError) return null;
    // Changing key forces React to destroy & recreate the entire subtree,
    // ensuring DragDropContext + DeferredChildren get a fresh mount.
    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

export default function OptimizedCalendarView() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Defer CalendarContent mount by one frame so that React 18's initial
  // concurrent render completes before @hello-pangea/dnd's DragDropContext
  // and its Droppable/Draggable children mount. Using flushSync forces the
  // state update to render synchronously, preventing React 18's concurrent
  // rendering from tearing DnD context during recoverFromConcurrentError.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    flushSync(() => { setReady(true); });
  }, []);

  return (
    <TasksProvider selectedDate={selectedDate}>
      <DnDErrorBoundary>
        {ready ? (
          <CalendarContent selectedDate={selectedDate} onDateChange={setSelectedDate} />
        ) : null}
      </DnDErrorBoundary>
      {process.env.NODE_ENV === 'development' && <CalendarPerformanceMonitor />}
    </TasksProvider>
  );
}
