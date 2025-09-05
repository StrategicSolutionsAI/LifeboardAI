"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
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

    // Handle drag from sidebar to calendar hour slots
    if ((source.droppableId === 'dailyTasks' || source.droppableId === 'openTasks') && isHour(destination.droppableId)) {
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
    if ((source.droppableId === 'dailyTasks' || source.droppableId === 'openTasks') && isCalendarDay(destination.droppableId)) {
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
