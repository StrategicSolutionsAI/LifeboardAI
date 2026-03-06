"use client";

import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { TasksProvider } from "@/contexts/tasks-context";
import { useBuckets } from "@/hooks/use-buckets";
import { useTasksContext } from "@/contexts/tasks-context";
import { CalendarHeaderSkeleton, CalendarMonthSkeleton, TaskListSkeleton } from "@/features/calendar/components/calendar-loading-skeleton";
import { CalendarPerformanceMonitor, useComponentLoadTime } from "@/features/calendar/components/calendar-performance-monitor";
import { useDragDropHandler } from "@/features/calendar/hooks/use-drag-drop-handler";
import { format } from "date-fns";

// Lazy load heavy components
const FullCalendar = lazy(() =>
  import("@/features/calendar/components/full-calendar").then(module => ({
    default: module.default
  }))
);

const CalendarTaskList = lazy(() =>
  import("@/features/calendar/components/calendar-task-list").then(module => ({
    default: module.CalendarTaskList
  }))
);

function CalendarLoading() {
  return (
    <div className="h-full w-full">
      <CalendarHeaderSkeleton />
      <div className="p-4">
        <CalendarMonthSkeleton />
      </div>
    </div>
  );
}

function TaskListLoading() {
  return (
    <div className="h-full w-full bg-white rounded-lg shadow-sm">
      <TaskListSkeleton />
    </div>
  );
}

interface CalendarContentProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

function CalendarContent({ selectedDate, onDateChange }: CalendarContentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { buckets, activeBucket } = useBuckets();
  const { batchUpdateTasks, allTasks } = useTasksContext();
  const selectedDateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);
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
          <Suspense fallback={<CalendarLoading />}>
            <FullCalendar
              selectedDate={selectedDate}
              onDateChange={onDateChange}
              availableBuckets={buckets}
              selectedBucket={activeBucket}
              isDragging={isDragging}

            />
          </Suspense>
        </div>

        {/* Task list sidebar — hidden on mobile */}
        {!isMobile && (
          <div
            className={`flex-shrink-0 w-full transition-[width] duration-300 ease-in-out ${
              isSidebarCollapsed ? 'lg:w-[64px]' : 'lg:w-[360px]'
            }`}
          >
            <Suspense fallback={<TaskListLoading />}>
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
            </Suspense>
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
