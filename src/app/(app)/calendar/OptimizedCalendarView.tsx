"use client";

import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { TasksProvider } from "@/contexts/tasks-context";
import { useBuckets } from "@/hooks/use-buckets";
import { useTasksContext } from "@/contexts/tasks-context";
import type { RepeatOption } from "@/types/tasks";
import { CalendarHeaderSkeleton, CalendarMonthSkeleton, CalendarWeekSkeleton, HourlyPlannerSkeleton, TaskListSkeleton } from "@/features/calendar/components/calendar-loading-skeleton";
import { CalendarPerformanceMonitor, useComponentLoadTime } from "@/features/calendar/components/calendar-performance-monitor";
import { format, addDays } from "date-fns";

// Lazy load heavy components with proper chunk names
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

// Calendar loading component
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

// Task list loading component
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
  const { batchUpdateTasks, allTasks, loading } = useTasksContext();
  const selectedDateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);
  const loadTime = useComponentLoadTime('CalendarContent');

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

  const handleDateChange = (newDate: Date) => {
    onDateChange(newDate);
  };

  // Unified drag and drop handler for sidebar to calendar
  const handleDragEnd = (result: DropResult) => {
    // console.log('[DnD] handleDragEnd', { source: result.source?.droppableId, destination: result.destination?.droppableId, draggableId: result.draggableId });
    // Ignore drops if a resize operation is active
    if (typeof document !== 'undefined' && document.body.classList.contains('lb-resizing')) {
      setIsDragging(false);
      return;
    }
    setIsDragging(false);
    if (!result.destination) {
      // console.log('[DnD] No destination - drop cancelled');
      return;
    }

    const { source, destination, draggableId } = result;

    // Helper functions
    const isHour = (id: string) => id.startsWith('hour-');
    const isCalendarDay = (id: string) => id.startsWith('calendar-day-');
    const hourKey = (id: string) => id.replace('hour-', '');

    // Extract real task ID from potentially prefixed draggable IDs
    const extractTaskId = (id: string) => {
      if (id.startsWith('allday::')) return id.replace('allday::', '');
      if (id.startsWith('lifeboard::')) return id.split('::')[1] ?? id;
      return id;
    };

    // Helper to check if source is from sidebar
    const isFromSidebar = (sourceId: string) => {
      return sourceId === 'dailyTasks' || 
             sourceId === 'openTasks' || 
             sourceId === 'masterTodayTasks' || 
             sourceId.startsWith('upcoming-');
    };

    // Handle drag from all-day strip to calendar hour slots
    // Allday draggables use "allday::<taskId>" to avoid ID collisions with hourly draggables
    if (source.droppableId === 'allday-strip' && isHour(destination.droppableId)) {
      const dstHour = destination.droppableId;
      const dateStr = selectedDateStr;
      const taskId = draggableId.replace('allday::', '');

      batchUpdateTasks([
        {
          taskId,
          updates: {
            hourSlot: dstHour,
            allDay: false,
            due: { date: dateStr },
          },
          occurrenceDate: dateStr,
        }
      ]).catch(error => {
        console.error('Failed to schedule all-day task to hour slot:', error);
      });
      return;
    }

    // Handle drag from all-day strip to sidebar lists (unschedule)
    if (source.droppableId === 'allday-strip' && (destination.droppableId === 'dailyTasks' || destination.droppableId === 'openTasks' || destination.droppableId === 'masterTodayTasks')) {
      const taskId = draggableId.replace('allday::', '');
      let updates: any = { hourSlot: null, endHourSlot: null };

      if (destination.droppableId === 'dailyTasks') {
        updates.due = { date: selectedDateStr };
        updates.startDate = selectedDateStr;
        updates.endDate = selectedDateStr;
        updates.allDay = true;
      } else if (destination.droppableId === 'masterTodayTasks') {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        updates.due = { date: todayStr };
        updates.startDate = todayStr;
        updates.endDate = todayStr;
        updates.allDay = true;
      } else if (destination.droppableId === 'openTasks') {
        updates.due = null;
        updates.startDate = null;
        updates.endDate = null;
        updates.allDay = true;
      }

      batchUpdateTasks([
        { taskId, updates, occurrenceDate: selectedDateStr }
      ]).catch(error => {
        console.error('Failed to move all-day task to sidebar:', error);
      });
      return;
    }

    // Handle drag from all-day strip to upcoming sections
    if (source.droppableId === 'allday-strip' && destination.droppableId.startsWith('upcoming-')) {
      const taskId = draggableId.replace('allday::', '');
      const groupKey = destination.droppableId.replace('upcoming-', '');
      let targetDate: string | undefined;
      const today = new Date();

      switch (groupKey) {
        case 'today': targetDate = format(today, 'yyyy-MM-dd'); break;
        case 'tomorrow': targetDate = format(addDays(today, 1), 'yyyy-MM-dd'); break;
        case 'thisWeek': targetDate = format(addDays(today, 3), 'yyyy-MM-dd'); break;
        case 'nextWeek': targetDate = format(addDays(today, 7), 'yyyy-MM-dd'); break;
        case 'later': targetDate = format(addDays(today, 14), 'yyyy-MM-dd'); break;
        case 'overdue': return;
        default: return;
      }

      if (targetDate) {
        batchUpdateTasks([
          { taskId, updates: { hourSlot: null as any, endHourSlot: null as any, due: { date: targetDate }, startDate: targetDate, endDate: targetDate, allDay: true }, occurrenceDate: targetDate }
        ]).catch(error => {
          console.error('Failed to move all-day task to upcoming:', error);
        });
      }
      return;
    }

    // Handle drag from sidebar to calendar hour slots
    if (isFromSidebar(source.droppableId) && isHour(destination.droppableId)) {
      const dstHour = destination.droppableId; // Keep full 'hour-<time>' format

      // Set hourSlot and due date for the selected date
      const dateStr = selectedDateStr;

      batchUpdateTasks([
        {
          taskId: draggableId,
          updates: {
            hourSlot: dstHour,
            allDay: false,
            due: { date: dateStr },
            startDate: dateStr,
            endDate: dateStr,
          },
          occurrenceDate: dateStr,
        }
      ]).catch(error => {
        console.error('Failed to schedule task to calendar hour:', error);
      });
      return;
    }

    // Handle drag from sidebar (or all-day strip) to the hourly planner wrapper
    // This catches drops that miss individual hour-slot Droppables (scroll-container issue)
    if ((isFromSidebar(source.droppableId) || source.droppableId === 'allday-strip') && destination.droppableId === 'hourly-planner-drop') {
      const dateStr = selectedDateStr;
      const taskId = source.droppableId === 'allday-strip' ? draggableId.replace('allday::', '') : draggableId;
      // Pick the nearest upcoming hour, or default to 9 AM
      const now = new Date();
      const currentHour = now.getHours();
      const nextHour = currentHour < 7 ? 9 : currentHour < 21 ? currentHour + 1 : 9;
      const displayHour = nextHour % 12 || 12;
      const period = nextHour < 12 ? 'AM' : 'PM';
      const dstHour = `hour-${displayHour}${period}`;

      batchUpdateTasks([
        {
          taskId,
          updates: {
            hourSlot: dstHour,
            allDay: false,
            due: { date: dateStr },
            startDate: dateStr,
            endDate: dateStr,
          },
          occurrenceDate: dateStr,
        }
      ]).catch(error => {
        console.error('Failed to schedule task to hourly planner:', error);
      });
      return;
    }

    // Handle drag from sidebar to calendar day (non-hour areas)
    if (isFromSidebar(source.droppableId) && isCalendarDay(destination.droppableId)) {
      const targetDateStr = destination.droppableId.replace('calendar-day-', '');

      batchUpdateTasks([
        {
          taskId: draggableId,
          updates: {
            due: { date: targetDateStr },
            startDate: targetDateStr,
            endDate: targetDateStr,
            hourSlot: null as any, // Remove hour slot when dropping on day area
            allDay: true,
          },
          occurrenceDate: targetDateStr,
        }
      ]).catch(error => {
        console.error('Failed to move task to calendar day:', error);
      });
      return;
    }

    // Handle drag from hour slot back to all-day strip
    if (isHour(source.droppableId) && destination.droppableId === 'allday-strip') {
      const dateStr = selectedDateStr;
      batchUpdateTasks([
        {
          taskId: draggableId,
          updates: {
            hourSlot: null as any,
            allDay: true,
            due: { date: dateStr },
          },
          occurrenceDate: dateStr,
        }
      ]).catch(error => {
        console.error('Failed to move task back to all-day:', error);
      });
      return;
    }

    // Handle moves from hourly slots back to sidebar task lists
    if (isHour(source.droppableId) && (destination.droppableId === 'dailyTasks' || destination.droppableId === 'openTasks' || destination.droppableId === 'masterTodayTasks')) {
      // Determine what updates to make based on destination
      let updates: any = { hourSlot: null }; // Always remove hour slot
      
      if (destination.droppableId === 'dailyTasks') {
        // Moving to daily tasks - set due date to selected date
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        updates.due = { date: dateStr };
      } else if (destination.droppableId === 'masterTodayTasks') {
        // Moving to master today tasks - set due date to today
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        updates.due = { date: todayStr };
      } else if (destination.droppableId === 'openTasks') {
        // Moving to open tasks - remove due date
        updates.due = null;
      }
      
      batchUpdateTasks([
        { taskId: draggableId, updates, occurrenceDate: selectedDateStr }
      ]).catch(error => {
        console.error('Failed to move task from hourly slot to sidebar:', error);
      });
      return;
    }

    // Handle moves from hourly slots to upcoming task sections
    if (isHour(source.droppableId) && destination.droppableId.startsWith('upcoming-')) {
      const groupKey = destination.droppableId.replace('upcoming-', '');
      
      let targetDate: string | undefined = undefined;
      const today = new Date();
      
      switch (groupKey) {
        case 'today':
          targetDate = format(today, 'yyyy-MM-dd');
          break;
        case 'tomorrow':
          targetDate = format(addDays(today, 1), 'yyyy-MM-dd');
          break;
        case 'thisWeek':
          targetDate = format(addDays(today, 3), 'yyyy-MM-dd');
          break;
        case 'nextWeek':
          targetDate = format(addDays(today, 7), 'yyyy-MM-dd');
          break;
        case 'later':
          targetDate = format(addDays(today, 14), 'yyyy-MM-dd');
          break;
        case 'overdue':
          console.warn('Cannot move task to overdue section');
          return;
        default:
          console.warn('Unknown upcoming group:', groupKey);
          return;
      }

      if (targetDate) {
        batchUpdateTasks([
          { taskId: draggableId, updates: { hourSlot: null as any, due: { date: targetDate } }, occurrenceDate: targetDate }
        ]).catch(error => {
          console.error('Failed to move task from hourly slot to upcoming:', error);
        });
      }
      return;
    }

    // Handle moves between hour slots in calendar
    if (isHour(source.droppableId) && isHour(destination.droppableId)) {
      const dstHour = destination.droppableId;
      
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour }, occurrenceDate: selectedDateStr }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }

    // Handle moves between calendar day columns (week/month views)
    if (isCalendarDay(source.droppableId) && isCalendarDay(destination.droppableId)) {
      const srcDate = source.droppableId.replace('calendar-day-', '');
      const destDate = destination.droppableId.replace('calendar-day-', '');
      if (srcDate === destDate) {
        return;
      }

      if (!draggableId.startsWith('lifeboard::')) {
        return;
      }

      const [, taskId] = draggableId.split('::');
      if (!taskId) return;

      const task = allTasks.find((t) => t.id?.toString?.() === taskId);
      const updates: any = { due: { date: destDate } };

      if (task?.hourSlot) {
        updates.hourSlot = task.hourSlot;
      } else {
        updates.hourSlot = null;
      }

      // Shift startDate/endDate to match the new due date so the task
      // immediately moves in the calendar (buildAllLifeboardEvents uses
      // startDate ?? due.date to place tasks on days).
      if (task?.startDate && task?.endDate && task.startDate !== task.endDate) {
        // Multi-day task: preserve the span by shifting both dates
        const srcMs = new Date(srcDate + 'T00:00:00').getTime();
        const dstMs = new Date(destDate + 'T00:00:00').getTime();
        const deltaMs = dstMs - srcMs;
        updates.startDate = format(new Date(new Date(task.startDate + 'T00:00:00').getTime() + deltaMs), 'yyyy-MM-dd');
        updates.endDate = format(new Date(new Date(task.endDate + 'T00:00:00').getTime() + deltaMs), 'yyyy-MM-dd');
      } else {
        // Single-day task: set both to destination date
        updates.startDate = destDate;
        updates.endDate = destDate;
      }

      batchUpdateTasks([
        { taskId, updates, occurrenceDate: destDate }
      ]).catch(error => {
        console.error('Failed to move lifeboard task between days:', error);
      });

      const detail = {
        taskId,
        fromDate: srcDate,
        toDate: destDate,
        title: task?.content ?? '',
        time: hourSlotToISO(task?.hourSlot ?? null, destDate),
        hourSlot: task?.hourSlot ?? null,
        allDay: !task?.hourSlot,
        duration: task?.duration,
        repeatRule: (task?.repeatRule ?? null) as RepeatOption | null,
      };
      window.dispatchEvent(new CustomEvent('lifeboard:calendar-task-moved', { detail }));
      return;
    }

    // Handle drag from calendar day cells to sidebar lists (unschedule)
    if (isCalendarDay(source.droppableId) && (destination.droppableId === 'dailyTasks' || destination.droppableId === 'openTasks' || destination.droppableId === 'masterTodayTasks')) {
      // console.log('[DnD] calendar-day → sidebar handler entered');
      if (!draggableId.startsWith('lifeboard::')) { return; }
      const taskId = draggableId.split('::')[1];
      if (!taskId) { return; }

      let updates: any = { hourSlot: null, endHourSlot: null };

      if (destination.droppableId === 'dailyTasks') {
        updates.due = { date: selectedDateStr };
        updates.startDate = selectedDateStr;
        updates.endDate = selectedDateStr;
        updates.allDay = true;
      } else if (destination.droppableId === 'masterTodayTasks') {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        updates.due = { date: todayStr };
        updates.startDate = todayStr;
        updates.endDate = todayStr;
        updates.allDay = true;
      } else if (destination.droppableId === 'openTasks') {
        updates.due = null;
        updates.startDate = null;
        updates.endDate = null;
        updates.allDay = true;
      }

      // console.log('[DnD] calling batchUpdateTasks', { taskId, updates, selectedDateStr });
      batchUpdateTasks([
        { taskId, updates, occurrenceDate: selectedDateStr }
      ]).then(() => {
        // console.log('[DnD] batchUpdateTasks succeeded');
      }).catch(error => {
        console.error('[DnD] batchUpdateTasks failed:', error);
      });
      return;
    }

    // Handle drag from calendar day cells to upcoming sections
    if (isCalendarDay(source.droppableId) && destination.droppableId.startsWith('upcoming-')) {
      if (!draggableId.startsWith('lifeboard::')) return;
      const taskId = draggableId.split('::')[1];
      if (!taskId) return;

      const groupKey = destination.droppableId.replace('upcoming-', '');
      let targetDate: string | undefined;
      const today = new Date();

      switch (groupKey) {
        case 'today': targetDate = format(today, 'yyyy-MM-dd'); break;
        case 'tomorrow': targetDate = format(addDays(today, 1), 'yyyy-MM-dd'); break;
        case 'thisWeek': targetDate = format(addDays(today, 3), 'yyyy-MM-dd'); break;
        case 'nextWeek': targetDate = format(addDays(today, 7), 'yyyy-MM-dd'); break;
        case 'later': targetDate = format(addDays(today, 14), 'yyyy-MM-dd'); break;
        case 'overdue': return;
        default: return;
      }

      if (targetDate) {
        batchUpdateTasks([
          { taskId, updates: { hourSlot: null as any, endHourSlot: null as any, due: { date: targetDate }, startDate: targetDate, endDate: targetDate, allDay: true }, occurrenceDate: targetDate }
        ]).catch(error => {
          console.error('Failed to move calendar task to upcoming:', error);
        });
      }
      return;
    }

    // Handle reordering within the same list
    if (source.droppableId === destination.droppableId && source.index !== destination.index) {

      // Dispatch custom events for list reordering
      const eventMap: Record<string, string> = {
        'openTasks': 'reorderOpenTasks',
        'dailyTasks': 'reorderDailyTasks',
        'masterTodayTasks': 'reorderMasterTodayTasks'
      };

      if (eventMap[source.droppableId]) {
        const reorderEvent = new CustomEvent(eventMap[source.droppableId], {
          detail: { source, destination, draggableId }
        });
        window.dispatchEvent(reorderEvent);
        return;
      }

      // For upcoming task sections
      if (source.droppableId.startsWith('upcoming-')) {
        const reorderEvent = new CustomEvent('reorderUpcomingTasks', {
          detail: { source, destination, draggableId }
        });
        window.dispatchEvent(reorderEvent);
        return;
      }
    }

    // Handle moves between sidebar lists
    if (source.droppableId === 'openTasks' && destination.droppableId === 'dailyTasks') {
      const dateStr = selectedDateStr;
      
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: { date: dateStr } } }
      ]).catch(error => {
        console.error('Failed to update task due date:', error);
      });
      return;
    }

    if (source.droppableId === 'openTasks' && destination.droppableId === 'masterTodayTasks') {
      const dateStr = selectedDateStr;

      batchUpdateTasks([
        {
          taskId: draggableId,
          updates: {
            due: { date: dateStr },
            hourSlot: null as any,
          },
          occurrenceDate: dateStr,
        },
      ]).catch((error) => {
        console.error('Failed to move task into Today list:', error);
      });
      return;
    }

    if (source.droppableId === 'dailyTasks' && destination.droppableId === 'openTasks') {
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: null } }
      ]).catch(error => {
        console.error('Failed to remove task due date:', error);
      });
      return;
    }

    if (source.droppableId === 'masterTodayTasks' && destination.droppableId === 'openTasks') {
      batchUpdateTasks([
        {
          taskId: draggableId,
          updates: {
            due: null as any,
            hourSlot: null as any,
          },
          occurrenceDate: selectedDateStr,
        },
      ]).catch((error) => {
        console.error('Failed to move task out of Today list:', error);
      });
      return;
    }

    // Handle moves between other list combinations
    // ... (remaining logic abbreviated for brevity)

  };

  return (
    <DragDropContext 
      onDragStart={(initial) => {
        setIsDragging(true);
      }}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full">
        {/* Main calendar area with Suspense */}
        <div className={`flex-1 min-w-0 min-h-0 transition-[margin] duration-300 ${isSidebarCollapsed ? 'lg:mr-0' : ''}`}>
          <Suspense fallback={<CalendarLoading />}>
            <FullCalendar
              selectedDate={selectedDate} 
              onDateChange={handleDateChange}
              availableBuckets={buckets}
              selectedBucket={activeBucket}
              isDragging={isDragging}
              disableInternalDragDrop={true}
            />
          </Suspense>
        </div>
        
        {/* Task list sidebar — hidden on mobile where agenda view shows events inline */}
        {!isMobile && (
          <div
            className={`flex-shrink-0 w-full transition-[width] duration-300 ease-in-out ${
              isSidebarCollapsed ? 'lg:w-[64px]' : 'lg:w-[360px]'
            }`}
          >
            <Suspense fallback={<TaskListLoading />}>
              <CalendarTaskList
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                availableBuckets={buckets}
                selectedBucket={activeBucket}
                isDragging={isDragging}
                disableInternalDragDrop={true}
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

// Helper function
const hourSlotToISO = (hourSlot: string | undefined | null, dateStr: string): string | undefined => {
  if (!hourSlot) return undefined;
  const label = hourSlot.replace(/^hour-/, '');
  const match = label.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/i);
  if (!match) return undefined;
  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  const base = new Date(`${dateStr}T00:00:00`);
  base.setHours(hour, minute, 0, 0);
  return base.toISOString();
};

export default function OptimizedCalendarView() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <TasksProvider selectedDate={selectedDate}>
      <CalendarContent selectedDate={selectedDate} onDateChange={setSelectedDate} />
      <CalendarPerformanceMonitor />
    </TasksProvider>
  );
}
