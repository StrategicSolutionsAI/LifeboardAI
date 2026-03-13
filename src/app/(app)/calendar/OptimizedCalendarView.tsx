"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { startOfMonth, endOfMonth } from "date-fns";
import { DragDropContext } from "@hello-pangea/dnd";
import { TasksProvider } from "@/contexts/tasks-context";
import { useBuckets } from "@/hooks/use-buckets";
import { useTaskData, useTaskActions } from "@/contexts/tasks-context";
import { useWidgets } from "@/hooks/use-widgets";
import { useToast } from "@/components/ui/use-toast";
import { CalendarPerformanceMonitor, useComponentLoadTime } from "@/features/calendar/components/calendar-performance-monitor";
import { useDragDropHandler, type HabitDropPayload } from "@/features/calendar/hooks/use-drag-drop-handler";
import { HabitScheduleDialog, deriveRepeatRule, type HabitScheduleMode } from "@/features/calendar/components/habit-schedule-dialog";
import { toDayKey } from "@/features/calendar/types";
import { prefetchToGlobalCache } from "@/hooks/use-data-cache";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { WidgetInstance } from "@/types/widgets";

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
  const { widgetsByBucket, updateWidget } = useWidgets();
  const { toast } = useToast();
  const selectedDateStr = useMemo(() => toDayKey(selectedDate), [selectedDate]);
  useComponentLoadTime('CalendarContent');

  // ── Habit-drop modal state ──
  const [pendingHabitDrop, setPendingHabitDrop] = useState<{
    widget: WidgetInstance;
    bucketName: string;
    targetDate: string;
  } | null>(null);
  const [isCreatingHabitTask, setIsCreatingHabitTask] = useState(false);

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

  // ── Habit drop handler ──
  const handleHabitDrop = useCallback(
    (payload: HabitDropPayload) => {
      // Find the widget in widgetsByBucket
      const widgets = widgetsByBucket[payload.bucketName] ?? [];
      const widget = widgets.find((w) => w.instanceId === payload.instanceId);
      if (!widget) return;

      // Already linked → toast instead of modal
      if (widget.linkedTaskId) {
        toast({ title: "Already linked", description: `"${widget.habitTrackerData?.habitName ?? widget.name}" already has a linked task.` });
        return;
      }

      setPendingHabitDrop({ widget, bucketName: payload.bucketName, targetDate: payload.targetDate });
    },
    [widgetsByBucket, toast],
  );

  // ── Habit confirm handler ──
  const handleHabitConfirm = useCallback(
    async (mode: HabitScheduleMode) => {
      if (!pendingHabitDrop) return;
      const { widget, bucketName, targetDate } = pendingHabitDrop;
      const habitName = widget.habitTrackerData?.habitName ?? widget.name ?? "Habit";
      const schedule = widget.schedule as boolean[] | undefined;

      setIsCreatingHabitTask(true);
      try {
        const repeat = mode === "repeat" ? deriveRepeatRule(schedule) : "none" as const;
        const task = await createTask(habitName, targetDate, null, bucketName, repeat, { allDay: true });

        if (task?.id) {
          updateWidget(bucketName, widget.instanceId, {
            linkedTaskId: task.id.toString(),
            linkedTaskSource: "supabase",
            linkedTaskAutoCreated: true,
            linkedTaskTitle: habitName,
            linkedTaskConfig: {
              enabled: true,
              title: habitName,
              bucket: bucketName,
              dueDate: targetDate,
              allDay: true,
              repeat,
            },
          });
          toast({ title: "Task created", description: `"${habitName}" added to ${targetDate}${mode === "repeat" ? " (recurring)" : ""}.` });
        }
      } catch (err) {
        console.error("Failed to create habit task:", err);
        toast({ title: "Failed to create task", description: "Please try again." });
      } finally {
        setIsCreatingHabitTask(false);
        setPendingHabitDrop(null);
      }
    },
    [pendingHabitDrop, createTask, updateWidget, toast],
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

      {/* Habit schedule dialog */}
      {pendingHabitDrop && (
        <HabitScheduleDialog
          open={true}
          onClose={() => setPendingHabitDrop(null)}
          onConfirm={handleHabitConfirm}
          widget={pendingHabitDrop.widget}
          targetDate={pendingHabitDrop.targetDate}
          isCreating={isCreatingHabitTask}
        />
      )}
    </DragDropContext>
  );
}

export default function OptimizedCalendarView() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Delay rendering DnD tree by one frame so module-level prefetchToGlobalCache
  // calls settle before @hello-pangea/dnd registers Droppable/Draggable elements.
  // Without this, prefetch resolution during React's initial commit can trigger
  // state updates that interrupt DnD setup, causing "Invariant failed" in production.
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  if (!ready) return null; // dynamic({ ssr: false }) loading skeleton is still visible

  return (
    <TasksProvider selectedDate={selectedDate}>
      <CalendarContent selectedDate={selectedDate} onDateChange={setSelectedDate} />
      {process.env.NODE_ENV === 'development' && <CalendarPerformanceMonitor />}
    </TasksProvider>
  );
}
