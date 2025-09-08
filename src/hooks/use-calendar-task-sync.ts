import { useCallback, useMemo } from 'react'
import { format, parseISO } from 'date-fns'

interface Task {
  id: string
  content: string
  completed: boolean
  due?: { date: string }
  duration?: number
  hourSlot?: string
  created_at?: string
  updated_at?: string
}

interface CalendarEvent {
  source: 'lifeboard' | 'google' | 'todoist'
  title: string
  time?: string
  allDay?: boolean
  taskId?: string
  duration?: number
}

// Hour mapping for time conversion
const HOUR_MAP: Record<string, number> = {
  '7AM': 7, '8AM': 8, '9AM': 9, '10AM': 10, '11AM': 11, '12PM': 12,
  '1PM': 13, '2PM': 14, '3PM': 15, '4PM': 16, '5PM': 17, '6PM': 18,
  '7PM': 19, '8PM': 20, '9PM': 21
};

/**
 * Hook to sync tasks with calendar events
 * Converts hourly scheduled tasks into calendar events for display
 */
export function useCalendarTaskSync(tasks: Task[], selectedDate: Date) {
  // Convert hour slot to actual time
  const hourSlotToTime = useCallback((hourSlot: string): string => {
    const hour = HOUR_MAP[hourSlot] || 9; // Default to 9 AM
    const date = new Date(selectedDate);
    date.setHours(hour, 0, 0, 0);
    
    return date.toISOString();
  }, [selectedDate]);

  // Convert time back to hour slot
  const timeToHourSlot = useCallback((timeString: string): string => {
    const date = new Date(timeString);
    const hour = date.getHours();
    
    if (hour === 0) return '12AM';
    if (hour < 12) return `${hour}AM`;
    if (hour === 12) return '12PM';
    return `${hour - 12}PM`;
  }, []);

  // Convert tasks to calendar events
  const taskEvents = useMemo((): CalendarEvent[] => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    return tasks
      .filter(task => 
        task.due?.date === dateStr && 
        !task.completed && 
        task.hourSlot // Only show tasks that have an hourSlot (are scheduled)
      )
      .map(task => ({
        source: 'lifeboard' as const,
        title: task.content,
        // Normalize hourSlot which may be stored as 'hour-7AM' or '7AM'
        time: hourSlotToTime((task.hourSlot || '9AM').replace(/^hour-/, '')),
        allDay: false,
        taskId: task.id,
        duration: task.duration || 60
      }));
  }, [tasks, selectedDate, hourSlotToTime]);

  // Get events for a specific date string (YYYY-MM-DD format)
  const getEventsForDate = useCallback((dateStr: string): CalendarEvent[] => {
    return tasks
      .filter(task => 
        task.due?.date === dateStr && 
        !task.completed && 
        task.hourSlot // Only show tasks that have an hourSlot (are scheduled)
      )
      .map(task => ({
        source: 'lifeboard' as const,
        title: task.content,
        time: hourSlotToTime((task.hourSlot || '9AM').replace(/^hour-/, '')),
        allDay: false,
        taskId: task.id,
        duration: task.duration || 60
      }));
  }, [tasks, hourSlotToTime]);

  // Update a task's time slot based on calendar event time
  const updateTaskTimeFromEvent = useCallback((taskId: string, newTime: string) => {
    const newHourSlot = timeToHourSlot(newTime);
    return {
      taskId,
      updates: {
        hourSlot: newHourSlot
      }
    };
  }, [timeToHourSlot]);

  return {
    taskEvents,
    getEventsForDate,
    updateTaskTimeFromEvent,
    hourSlotToTime,
    timeToHourSlot
  };
}
