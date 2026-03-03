"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { format, addDays, differenceInCalendarDays } from "date-fns";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { TasksProvider } from "@/contexts/tasks-context";
import { CalendarTaskList } from "@/components/calendar-task-list";
import { useBuckets } from "@/hooks/use-buckets";
import { useTasksContext } from "@/contexts/tasks-context";
import type { RepeatOption } from "@/hooks/use-tasks";

// Load calendar grid on client to avoid SSR issues with date-fns
const FullCalendar = dynamic(() => import("@/components/full-calendar"), { ssr: false });

interface CalendarContentInnerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

function CalendarContentInner({ selectedDate, onDateChange }: CalendarContentInnerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { buckets, activeBucket } = useBuckets();
  const { batchUpdateTasks, allTasks } = useTasksContext();
  const selectedDateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  const handleDateChange = (newDate: Date) => {
    onDateChange(newDate);
  };

  // Unified drag and drop handler for sidebar to calendar
  const handleDragEnd = (result: DropResult) => {
    
    // Ignore drops if a resize operation is active
    if (typeof document !== 'undefined' && document.body.classList.contains('lb-resizing')) {
      setIsDragging(false);
      return;
    }
    setIsDragging(false);
    if (!result.destination) {
      return;
    }

    const { source, destination, draggableId } = result;

    // Helper functions
    const isHour = (id: string) => id.startsWith('hour-');
    const isCalendarDay = (id: string) => id.startsWith('calendar-day-');
    const hourKey = (id: string) => id.replace('hour-', '');


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
            endHourSlot: null,
            due: { date: dateStr },
            startDate: dateStr,
            endDate: dateStr,
            allDay: false,
          },
          occurrenceDate: dateStr,
        }
      ]).catch(error => {
        console.error('Failed to schedule task to calendar hour:', error);
      });
      return;
    }

    // Handle drag from sidebar (or all-day strip) to the hourly planner wrapper
    if ((isFromSidebar(source.droppableId) || source.droppableId === 'allday-strip') && destination.droppableId === 'hourly-planner-drop') {
      const dateStr = selectedDateStr;
      const taskId = source.droppableId === 'allday-strip' ? draggableId.replace('allday::', '') : draggableId;
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
            endHourSlot: null as any,
            allDay: true,
          },
          occurrenceDate: targetDateStr,
        }
      ]).catch(error => {
        console.error('Failed to move task to calendar day:', error);
      });
      return;
    }

    // Handle moves from hourly slots back to sidebar task lists
    if (isHour(source.droppableId) && (destination.droppableId === 'dailyTasks' || destination.droppableId === 'openTasks' || destination.droppableId === 'masterTodayTasks')) {
      // Determine what updates to make based on destination
      let updates: any = { hourSlot: null }; // Always remove hour slot
      updates.endHourSlot = null;
      
      if (destination.droppableId === 'dailyTasks') {
        // Moving to daily tasks - set due date to selected date
        const dateStr = `${selectedDate.getFullYear()}-${String(
          selectedDate.getMonth() + 1
        ).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
        updates.due = { date: dateStr };
        updates.startDate = dateStr;
        updates.endDate = dateStr;
        updates.allDay = true;
      } else if (destination.droppableId === 'masterTodayTasks') {
        // Moving to master today tasks - set due date to today
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(
          today.getMonth() + 1
        ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        updates.due = { date: todayStr };
        updates.startDate = todayStr;
        updates.endDate = todayStr;
        updates.allDay = true;
      } else if (destination.droppableId === 'openTasks') {
        // Moving to open tasks - remove due date
        updates.due = null;
        updates.startDate = null;
        updates.endDate = null;
        updates.allDay = true;
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
          { taskId: draggableId, updates: { hourSlot: null as any, endHourSlot: null as any, due: { date: targetDate }, startDate: targetDate, endDate: targetDate, allDay: true }, occurrenceDate: targetDate }
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
        { taskId: draggableId, updates: { hourSlot: dstHour, allDay: false }, occurrenceDate: selectedDateStr }
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
      const taskStart = task?.startDate ?? task?.due?.date ?? srcDate;
      const taskEnd = task?.endDate ?? taskStart;
      const deltaDays = differenceInCalendarDays(new Date(destDate), new Date(srcDate));

      const shiftDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return destDate;
        const base = new Date(`${dateStr}T00:00:00`);
        const shifted = addDays(base, deltaDays);
        return format(shifted, 'yyyy-MM-dd');
      };

      const newStartDate = shiftDate(taskStart);
      const newEndDate = shiftDate(taskEnd);
      const taskAllDay = task?.allDay ?? !task?.hourSlot;

      const updates: any = {
        due: { date: newStartDate },
        startDate: newStartDate,
        endDate: newEndDate,
        allDay: taskAllDay,
      };

      if (task?.hourSlot) {
        updates.hourSlot = task.hourSlot;
      } else {
        updates.hourSlot = null;
      }
      if (task?.endHourSlot !== undefined) {
        updates.endHourSlot = task.endHourSlot;
      }

      batchUpdateTasks([
        { taskId, updates, occurrenceDate: destDate }
      ]).catch(error => {
        console.error('Failed to move lifeboard task between days:', error);
      });

      const isoTime = hourSlotToISO(task?.hourSlot ?? null, newStartDate);
      const detail = {
        taskId,
        fromDate: srcDate,
        toDate: destDate,
        title: task?.content ?? '',
        time: isoTime,
        hourSlot: task?.hourSlot ?? null,
        allDay: taskAllDay,
        duration: task?.duration,
        repeatRule: (task?.repeatRule ?? null) as RepeatOption | null,
        startDate: newStartDate,
        endDate: newEndDate,
      };
      window.dispatchEvent(new CustomEvent('lifeboard:calendar-task-moved', { detail }));
      return;
    }

    // Handle reordering within the same list
    if (source.droppableId === destination.droppableId && source.index !== destination.index) {
      
      // For openTasks, we need to get the current task list and calculate new positions
      if (source.droppableId === 'openTasks') {
        // This will be handled by a custom event or we need to expose the task list
        // For now, let's dispatch a custom event that the CalendarTaskList can listen to
        const reorderEvent = new CustomEvent('reorderOpenTasks', {
          detail: { source, destination, draggableId }
        });
        window.dispatchEvent(reorderEvent);
        return;
      }
      
      // For dailyTasks, similar approach
      if (source.droppableId === 'dailyTasks') {
        const reorderEvent = new CustomEvent('reorderDailyTasks', {
          detail: { source, destination, draggableId }
        });
        window.dispatchEvent(reorderEvent);
        return;
      }

      // For masterTodayTasks, similar approach
      if (source.droppableId === 'masterTodayTasks') {
        const reorderEvent = new CustomEvent('reorderMasterTodayTasks', {
          detail: { source, destination, draggableId }
        });
        window.dispatchEvent(reorderEvent);
        return;
      }

      // For upcoming task sections, dispatch reorder event
      if (source.droppableId.startsWith('upcoming-')) {
        const reorderEvent = new CustomEvent('reorderUpcomingTasks', {
          detail: { source, destination, draggableId }
        });
        window.dispatchEvent(reorderEvent);
        return;
      }
    }

    // Handle moves between sidebar lists (existing functionality)
    if (source.droppableId === 'openTasks' && destination.droppableId === 'dailyTasks') {
      const dateStr = `${selectedDate.getFullYear()}-${String(
        selectedDate.getMonth() + 1
      ).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
      
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: { date: dateStr }, startDate: dateStr, endDate: dateStr, hourSlot: undefined, endHourSlot: undefined, allDay: true } }
      ]).catch(error => {
        console.error('Failed to update task due date:', error);
      });
      return;
    }

    if (source.droppableId === 'dailyTasks' && destination.droppableId === 'openTasks') {
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: undefined, startDate: null, endDate: null, hourSlot: undefined, endHourSlot: undefined, allDay: true } }
      ]).catch(error => {
        console.error('Failed to remove task due date:', error);
      });
      return;
    }

    // Handle moves between openTasks and masterTodayTasks (Master List today section)
    if (source.droppableId === 'openTasks' && destination.droppableId === 'masterTodayTasks') {
      // Get today's date string for setting due date
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      
      
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: { date: todayStr }, startDate: todayStr, endDate: todayStr, hourSlot: undefined, endHourSlot: undefined, allDay: true } }
      ]).catch(error => {
        console.error('Failed to update task due date:', error);
      });
      return;
    }

    if (source.droppableId === 'masterTodayTasks' && destination.droppableId === 'openTasks') {
      
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: undefined, startDate: null, endDate: null, hourSlot: undefined, endHourSlot: undefined, allDay: true } }
      ]).catch(error => {
        console.error('Failed to remove task due date:', error);
      });
      return;
    }

    // Handle moves from upcoming task sections to other lists
    if (source.droppableId.startsWith('upcoming-')) {
      if (destination.droppableId === 'openTasks') {
        
        batchUpdateTasks([
          { taskId: draggableId, updates: { due: undefined, startDate: null, endDate: null, hourSlot: undefined, endHourSlot: undefined, allDay: true } }
        ]).catch(error => {
          console.error('Failed to remove task due date:', error);
        });
        return;
      }

      if (destination.droppableId === 'dailyTasks') {
        const dateStr = `${selectedDate.getFullYear()}-${String(
          selectedDate.getMonth() + 1
        ).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
        
        
        batchUpdateTasks([
          { taskId: draggableId, updates: { due: { date: dateStr }, startDate: dateStr, endDate: dateStr, hourSlot: undefined, endHourSlot: undefined, allDay: true } }
        ]).catch(error => {
          console.error('Failed to update task due date:', error);
        });
        return;
      }

      if (destination.droppableId === 'masterTodayTasks') {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(
          today.getMonth() + 1
        ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        
        
        batchUpdateTasks([
          { taskId: draggableId, updates: { due: { date: todayStr }, startDate: todayStr, endDate: todayStr, hourSlot: undefined, endHourSlot: undefined, allDay: true } }
        ]).catch(error => {
          console.error('Failed to update task due date:', error);
        });
        return;
      }
    }

    // Handle moves from other lists to upcoming sections (these would change due dates)
    if (destination.droppableId.startsWith('upcoming-')) {
      const groupKey = destination.droppableId.replace('upcoming-', '');
      let targetDate: string | undefined = undefined;

      // Calculate target date based on upcoming group
      const today = new Date();
      switch (groupKey) {
        case 'today':
          targetDate = format(today, 'yyyy-MM-dd');
          break;
        case 'tomorrow':
          targetDate = format(addDays(today, 1), 'yyyy-MM-dd');
          break;
        case 'thisWeek':
          // Set to end of this week as a default
          targetDate = format(addDays(today, 3), 'yyyy-MM-dd');
          break;
        case 'nextWeek':
          // Set to start of next week
          targetDate = format(addDays(today, 7), 'yyyy-MM-dd');
          break;
        case 'later':
          // Set to a week from now
          targetDate = format(addDays(today, 14), 'yyyy-MM-dd');
          break;
        case 'overdue':
          // Don't allow moving to overdue - this doesn't make sense
          console.warn('Cannot move task to overdue section');
          return;
        default:
          console.warn('Unknown upcoming group:', groupKey);
          return;
      }

      if (targetDate) {
        
        batchUpdateTasks([
          { taskId: draggableId, updates: { due: { date: targetDate }, startDate: targetDate, endDate: targetDate, hourSlot: undefined, endHourSlot: undefined, allDay: true } }
        ]).catch(error => {
          console.error('Failed to update task due date:', error);
        });
        return;
      }
    }

  };

  return (
    <DragDropContext 
      onDragStart={(initial) => {
        setIsDragging(true);
      }} 
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full">
        {/* Main calendar area */}
        <div className={`flex-1 min-w-0 min-h-0 transition-[margin] duration-300 ${isSidebarCollapsed ? 'lg:mr-0' : ''}`}>
          <FullCalendar
            selectedDate={selectedDate} 
            onDateChange={handleDateChange}
            availableBuckets={buckets}
            selectedBucket={activeBucket}
            isDragging={isDragging}
            disableInternalDragDrop={true} // Use parent DragDropContext to avoid nesting
          />
        </div>
        
        {/* Task list sidebar */}
        <div
          className={`flex-shrink-0 w-full transition-[width] duration-300 ease-in-out ${
            isSidebarCollapsed ? 'lg:w-[64px]' : 'lg:w-[360px]'
          }`}
        >
          <CalendarTaskList
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            availableBuckets={buckets}
            selectedBucket={activeBucket}
            isDragging={isDragging}
            disableInternalDragDrop={true} // Disable internal DragDropContext
            onCollapsedChange={setIsSidebarCollapsed}
          />
        </div>
      </div>
    </DragDropContext>
  );
}

function CalendarContent() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <TasksProvider selectedDate={selectedDate}>
      <CalendarContentInner
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />
    </TasksProvider>
  );
}

export default function CalendarView() {
  return <CalendarContent />;
}
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
