"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { format, addDays } from "date-fns";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { TasksProvider } from "@/contexts/tasks-context";
import { CalendarTaskList } from "@/components/calendar-task-list";
import { useBuckets } from "@/hooks/use-buckets";
import { useTasksContext } from "@/contexts/tasks-context";

// Load calendar grid on client to avoid SSR issues with date-fns
const FullCalendar = dynamic(() => import("@/components/full-calendar"), { ssr: false });

function CalendarContent() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDragging, setIsDragging] = useState(false);
  const { buckets, activeBucket } = useBuckets();
  const { batchUpdateTasks } = useTasksContext();

  const handleDateChange = (newDate: Date) => {
    console.log('📅 Calendar date changed:', newDate);
    setSelectedDate(newDate);
  };

  // Unified drag and drop handler for sidebar to calendar
  const handleDragEnd = (result: DropResult) => {
    console.log('🎯 CalendarView handleDragEnd called:', result);
    
    // Ignore drops if a resize operation is active
    if (typeof document !== 'undefined' && document.body.classList.contains('lb-resizing')) {
      console.log('❌ Drag ignored - resize operation active');
      setIsDragging(false);
      return;
    }
    setIsDragging(false);
    if (!result.destination) {
      console.log('❌ No destination in drag result');
      return;
    }

    const { source, destination, draggableId } = result;

    // Helper functions
    const isHour = (id: string) => id.startsWith('hour-');
    const isCalendarDay = (id: string) => id.startsWith('calendar-day-');
    const hourKey = (id: string) => id.replace('hour-', '');

    console.log('🎯 Unified drag operation:', { source: source.droppableId, destination: destination.droppableId, draggableId });

    // Helper to check if source is from sidebar
    const isFromSidebar = (sourceId: string) => {
      return sourceId === 'dailyTasks' || 
             sourceId === 'openTasks' || 
             sourceId === 'masterTodayTasks' || 
             sourceId.startsWith('upcoming-');
    };

    // Handle drag from sidebar to calendar hour slots
    if (isFromSidebar(source.droppableId) && isHour(destination.droppableId)) {
      const dstHour = destination.droppableId; // Keep full 'hour-<time>' format
      console.log('📅➡️⏰ Sidebar task → Calendar hour slot:', { draggableId, dstHour });
      
      // Set hourSlot and due date for the selected date
      const dateStr = `${selectedDate.getFullYear()}-${String(
        selectedDate.getMonth() + 1
      ).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
      
      batchUpdateTasks([
        { 
          taskId: draggableId, 
          updates: { 
            hourSlot: dstHour,
            due: { date: dateStr }
          } 
        }
      ]).catch(error => {
        console.error('Failed to schedule task to calendar hour:', error);
      });
      return;
    }

    // Handle drag from sidebar to calendar day (non-hour areas)
    if (isFromSidebar(source.droppableId) && isCalendarDay(destination.droppableId)) {
      const targetDateStr = destination.droppableId.replace('calendar-day-', '');
      console.log('📅➡️📅 Sidebar task → Calendar day:', { draggableId, targetDateStr });
      
      batchUpdateTasks([
        { 
          taskId: draggableId, 
          updates: { 
            due: { date: targetDateStr },
            hourSlot: undefined // Remove hour slot when dropping on day area
          } 
        }
      ]).catch(error => {
        console.error('Failed to move task to calendar day:', error);
      });
      return;
    }

    // Handle moves from hourly slots back to sidebar task lists
    if (isHour(source.droppableId) && (destination.droppableId === 'dailyTasks' || destination.droppableId === 'openTasks' || destination.droppableId === 'masterTodayTasks')) {
      console.log('⏰➡️📋 Calendar hour → Sidebar:', { 
        draggableId, 
        from: source.droppableId, 
        to: destination.droppableId, 
        targetIndex: destination.index 
      });
      
      // Determine what updates to make based on destination
      let updates: any = { hourSlot: null }; // Always remove hour slot
      
      if (destination.droppableId === 'dailyTasks') {
        // Moving to daily tasks - set due date to selected date
        const dateStr = `${selectedDate.getFullYear()}-${String(
          selectedDate.getMonth() + 1
        ).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
        updates.due = { date: dateStr };
      } else if (destination.droppableId === 'masterTodayTasks') {
        // Moving to master today tasks - set due date to today
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(
          today.getMonth() + 1
        ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        updates.due = { date: todayStr };
      } else if (destination.droppableId === 'openTasks') {
        // Moving to open tasks - remove due date
        updates.due = null;
      }
      
      batchUpdateTasks([
        { taskId: draggableId, updates }
      ]).catch(error => {
        console.error('Failed to move task from hourly slot to sidebar:', error);
      });
      return;
    }

    // Handle moves from hourly slots to upcoming task sections
    if (isHour(source.droppableId) && destination.droppableId.startsWith('upcoming-')) {
      const groupKey = destination.droppableId.replace('upcoming-', '');
      console.log('⏰➡️📋 Calendar hour → Upcoming section:', { draggableId, groupKey });
      
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
          { taskId: draggableId, updates: { hourSlot: undefined, due: { date: targetDate } } }
        ]).catch(error => {
          console.error('Failed to move task from hourly slot to upcoming:', error);
        });
      }
      return;
    }

    // Handle moves between hour slots in calendar
    if (isHour(source.droppableId) && isHour(destination.droppableId)) {
      const dstHour = destination.droppableId;
      console.log('⏰➡️⏰ Calendar hour → Calendar hour:', { draggableId, dstHour });
      
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour } }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }

    // Handle reordering within the same list
    if (source.droppableId === destination.droppableId && source.index !== destination.index) {
      console.log('🔄 Reordering within same list:', { list: source.droppableId, from: source.index, to: destination.index });
      
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
        { taskId: draggableId, updates: { due: { date: dateStr } } }
      ]).catch(error => {
        console.error('Failed to update task due date:', error);
      });
      return;
    }

    if (source.droppableId === 'dailyTasks' && destination.droppableId === 'openTasks') {
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: undefined } }
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
      
      console.log('📋➡️📅 Open task → Master List Today:', { draggableId, todayStr });
      
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: { date: todayStr } } }
      ]).catch(error => {
        console.error('Failed to update task due date:', error);
      });
      return;
    }

    if (source.droppableId === 'masterTodayTasks' && destination.droppableId === 'openTasks') {
      console.log('📅➡️📋 Master List Today → Open task:', { draggableId });
      
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: undefined } }
      ]).catch(error => {
        console.error('Failed to remove task due date:', error);
      });
      return;
    }

    // Handle moves from upcoming task sections to other lists
    if (source.droppableId.startsWith('upcoming-')) {
      if (destination.droppableId === 'openTasks') {
        console.log('📋➡️📋 Upcoming task → Open tasks:', { draggableId });
        
        batchUpdateTasks([
          { taskId: draggableId, updates: { due: undefined } }
        ]).catch(error => {
          console.error('Failed to remove task due date:', error);
        });
        return;
      }

      if (destination.droppableId === 'dailyTasks') {
        const dateStr = `${selectedDate.getFullYear()}-${String(
          selectedDate.getMonth() + 1
        ).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
        
        console.log('📋➡️📅 Upcoming task → Daily tasks:', { draggableId, dateStr });
        
        batchUpdateTasks([
          { taskId: draggableId, updates: { due: { date: dateStr } } }
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
        
        console.log('📋➡️📅 Upcoming task → Master List Today:', { draggableId, todayStr });
        
        batchUpdateTasks([
          { taskId: draggableId, updates: { due: { date: todayStr } } }
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
        console.log(`📋➡️📋 Task → Upcoming ${groupKey}:`, { draggableId, targetDate });
        
        batchUpdateTasks([
          { taskId: draggableId, updates: { due: { date: targetDate } } }
        ]).catch(error => {
          console.error('Failed to update task due date:', error);
        });
        return;
      }
    }

    console.log('Unhandled drag operation:', result);
  };

  return (
    <DragDropContext 
      onDragStart={(initial) => {
        console.log('🚀 CalendarView onDragStart:', initial);
        setIsDragging(true);
      }} 
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 h-full">
        {/* Main calendar area */}
        <div className="flex-1 min-w-0">
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
        <div className="flex-shrink-0">
          <CalendarTaskList 
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            availableBuckets={buckets}
            selectedBucket={activeBucket}
            isDragging={isDragging}
            disableInternalDragDrop={true} // Disable internal DragDropContext
          />
        </div>
      </div>
    </DragDropContext>
  );
}

export default function CalendarView() {
  return (
    <TasksProvider selectedDate={new Date()}>
      <CalendarContent />
    </TasksProvider>
  );
}
