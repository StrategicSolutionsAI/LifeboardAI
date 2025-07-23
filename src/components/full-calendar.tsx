"use client";

import { useState, useEffect } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
  addDays,
  format,
  parseISO,
  addWeeks,
  subWeeks,
  startOfDay,
  endOfDay,
  isWithinInterval,
} from "date-fns";

import HourlyPlanner from "@/components/hourly-planner";
import { useTasksContext } from "@/contexts/tasks-context";
import { useCalendarTaskSync } from "@/hooks/use-calendar-task-sync";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";

type CalendarView = 'month' | 'week' | 'day';

function buildMonthMatrix(currentMonth: Date) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const rows: Date[][] = [];
  let day = startDate;
  let formattedDate = "";
  while (day <= endDate) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    rows.push(week);
  }
  return rows;
}

function buildWeekMatrix(currentDate: Date) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    week.push(addDays(weekStart, i));
  }
  return [week];
}

function buildDayMatrix(currentDate: Date) {
  return [[currentDate]];
}

interface DayEvent { source: 'google' | 'todoist' | 'lifeboard'; title: string; time?: string; allDay?: boolean; taskId?: string; duration?: number; }

interface FullCalendarProps {
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
}

export default function FullCalendar({ selectedDate: propSelectedDate, onDateChange }: FullCalendarProps = {}) {
  const [currentDate, setCurrentDate] = useState(propSelectedDate || new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [eventsByDate, setEventsByDate] = useState<Record<string, DayEvent[]>>({});
  const today = new Date();
  const [selectedModalDate, setSelectedModalDate] = useState<string | null>(null);
  
  // Get tasks from context
  const { allTasks, scheduledTasks, batchUpdateTasks } = useTasksContext();
  
  // Use calendar sync hook
  const { getEventsForDate } = useCalendarTaskSync(allTasks, currentDate);

  const nextPeriod = () => {
    setCurrentDate((date) => {
      const newDate = (() => {
        switch (view) {
          case 'month':
            return addMonths(date, 1);
          case 'week':
            return addWeeks(date, 1);
          case 'day':
            return addDays(date, 1);
          default:
            return date;
        }
      })();
      onDateChange?.(newDate);
      return newDate;
    });
  };

  const prevPeriod = () => {
    setCurrentDate((date) => {
      const newDate = (() => {
        switch (view) {
          case 'month':
            return subMonths(date, 1);
          case 'week':
            return addWeeks(date, -1);
          case 'day':
            return addDays(date, -1);
          default:
            return date;
        }
      })();
      onDateChange?.(newDate);
      return newDate;
    });
  };

  const getDateRange = () => {
    switch (view) {
      case 'month':
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate)
        };
      case 'week':
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 0 }),
          end: endOfWeek(currentDate, { weekStartsOn: 0 })
        };
      case 'day':
        return {
          start: startOfDay(currentDate),
          end: endOfDay(currentDate)
        };
      default:
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate)
        };
    }
  };

  const getMatrix = () => {
    switch (view) {
      case 'month':
        return buildMonthMatrix(currentDate);
      case 'week':
        return buildWeekMatrix(currentDate);
      case 'day':
        return buildDayMatrix(currentDate);
      default:
        return buildMonthMatrix(currentDate);
    }
  };

  const getHeaderTitle = () => {
    switch (view) {
      case 'month':
        return format(currentDate, "MMMM yyyy");
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
      case 'day':
        return format(currentDate, "EEEE, MMMM d, yyyy");
      default:
        return format(currentDate, "MMMM yyyy");
    }
  };

  const rows = getMatrix();

  // Unified drag and drop handler for calendar day view
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // Helper functions
    const isHour = (id: string) => id.startsWith('hour-');
    const hourKey = (id: string) => id.replace('hour-', '');

    // Handle moves between hour slots in day view
    if (isHour(source.droppableId) && isHour(destination.droppableId)) {
      // Hour slot → Different hour slot: Update the hourSlot
      const dstHour = hourKey(destination.droppableId);
      console.log('⏰ Moving task between hour slots in calendar day view:', { draggableId, dstHour });
      
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour } }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }

    console.log('Unhandled drag operation in calendar:', result);
  };

  // Sync propSelectedDate prop with currentDate state
  useEffect(() => {
    if (propSelectedDate && propSelectedDate.getTime() !== currentDate.getTime()) {
      setCurrentDate(propSelectedDate);
    }
  }, [propSelectedDate, currentDate]);

  // Fetch events whenever date range or view changes
  useEffect(() => {
    async function fetchEvents() {
      const { start, end } = getDateRange();
      const timeMin = start.toISOString();
      const timeMax = end.toISOString();

      const map: Record<string, DayEvent[]> = {};

      // ---------------- Google Calendar ----------------
      try {
        const resp = await fetch(`/api/integrations/google/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=2500`);
        if (resp.ok) {
          const data = await resp.json();
          (data.events ?? []).forEach((ev: any) => {
            const dateStr = ev.start?.date ?? (ev.start?.dateTime ? ev.start.dateTime.slice(0,10) : null);
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = [];
            map[dateStr].push({ source: 'google', title: ev.summary ?? 'Event', time: ev.start?.dateTime ?? undefined, allDay: !!ev.start?.date });
          });
        }
      } catch (err) {
        console.error('Failed to fetch Google events', err);
      }

      // ---------------- Lifeboard Hourly Tasks ----------------
      // Add hourly scheduled tasks from the current context
      const dateRange = [];
      let currentDay = new Date(start);
      while (currentDay <= end) {
        const dateStr = format(currentDay, 'yyyy-MM-dd');
        const dayEvents = getEventsForDate(dateStr);
        
        if (dayEvents.length > 0) {
          if (!map[dateStr]) map[dateStr] = [];
          dayEvents.forEach(event => {
            map[dateStr].push({
              source: 'lifeboard',
              title: event.title,
              time: event.time,
              allDay: event.allDay || false,
              taskId: event.taskId,
              duration: event.duration
            });
          });
        }
        
        currentDay = addDays(currentDay, 1);
      }

      // ---------------- Todoist Tasks (non-hourly) ----------------
      try {
        const resp = await fetch('/api/integrations/todoist/tasks?all=true');
        if (resp.ok) {
          const data = await resp.json();
          const tasks: any[] = Array.isArray(data) ? data : (data.tasks ?? []);
          tasks.forEach((t: any) => {
            const dateStr: string | undefined = t.due?.date;
            if (!dateStr) return;
            // Only include tasks within the current date range
            if (dateStr >= timeMin.slice(0,10) && dateStr <= timeMax.slice(0,10)) {
              if (!map[dateStr]) map[dateStr] = [];
              
              // Skip tasks that already have hourSlot (they're handled above as lifeboard events)
              if (t.hourSlot) return;
              
              map[dateStr].push({ 
                source: 'todoist', 
                title: t.content ?? 'Task', 
                time: t.due?.datetime ?? undefined,
                taskId: t.id
              });
            }
          });
        }
      } catch (err) {
        console.error('Failed to fetch Todoist tasks', err);
      }

      setEventsByDate(map);
    }

    fetchEvents();
  }, [currentDate, view, allTasks, getEventsForDate]);

  const getCellSize = () => {
    switch (view) {
      case 'month':
        return 'aspect-square';
      case 'week':
        return 'h-32';
      case 'day':
        return 'min-h-[600px]';
      default:
        return 'aspect-square';
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-sm">
      {/* Header with View Selector */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevPeriod}
          className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600"
        >
          &lt;
        </button>
        
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {getHeaderTitle()}
          </h2>
          
          {/* View Selector Dropdown */}
          <select 
            value={view} 
            onChange={(e) => setView(e.target.value as CalendarView)}
            title="Calendar view selector"
            className="px-3 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="month">Month</option>
            <option value="week">Week</option>
            <option value="day">Day</option>
          </select>
        </div>
        
        <button
          onClick={nextPeriod}
          className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600"
        >
          &gt;
        </button>
      </div>

      {/* Week Days Header - only show for month and week views */}
      {(view === 'month' || view === 'week') && (
        <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
      )}

      {/* Calendar Grid */}
      {view === 'day' ? (
        // Day view: Use HourlyPlanner
        <div className="bg-white rounded-md border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {format(currentDate, "EEEE, MMMM d, yyyy")}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Plan your day with hourly scheduling
            </p>
          </div>
          
          <DragDropContext onDragEnd={handleDragEnd}>
            <HourlyPlanner 
              className="max-h-[70vh] overflow-y-auto" 
              showTimeIndicator={true}
              allowResize={true}
            />
          </DragDropContext>
        </div>
      ) : (
        // Month and Week views: Use calendar grid
        <div className={`grid grid-cols-7 gap-px bg-gray-200 rounded-md overflow-hidden`}>
          {rows.flat().map((day: Date, idx: number) => {
            const dayStr = day.toISOString().slice(0,10);
            const dayEvents = eventsByDate[dayStr] ?? [];
            const isCurrentMonth = view === 'month' ? isSameMonth(day, currentDate) : true;
            const isToday = isSameDay(day, today);
            
            return (
              <div
                key={idx}
                onClick={() => dayEvents.length && setSelectedModalDate(dayStr)}
                className={`${getCellSize()} cursor-pointer flex flex-col items-start justify-start text-sm p-2 ${
                  isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400"
                } ${isToday ? "border-2 border-indigo-500" : ""}`}
              >
                {/* Date Header */}
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-medium">
                    {format(day, "d")}
                  </span>
                </div>
                
                {/* Events */}
                {dayEvents.length > 0 && (
                  <div className={`w-full ${view === 'week' ? 'space-y-1' : 'flex flex-wrap gap-0.5'}`}>
                    {view === 'week' ? (
                      // Week view: show first few event titles with time
                      dayEvents.slice(0, 3).map((ev: DayEvent, i: number) => {
                        const getEventStyle = (source: string) => {
                          switch (source) {
                            case 'google':
                              return { backgroundColor: '#dbeafe', color: '#1e40af' };
                            case 'lifeboard':
                              return { backgroundColor: '#dcfce7', color: '#166534' };
                            default:
                              return { backgroundColor: '#e0e7ff', color: '#3730a3' };
                          }
                        };
                        
                        const timeDisplay = ev.time ? format(new Date(ev.time), 'h:mm a') : '';
                        
                        return (
                          <div key={i} className="text-xs p-0.5 rounded truncate w-full" style={getEventStyle(ev.source)}>
                            {timeDisplay && <span className="font-medium">{timeDisplay}</span>} {ev.title}
                          </div>
                        );
                      })
                    ) : (
                      // Month view: show dots with different colors
                      dayEvents.slice(0, 3).map((ev: DayEvent, i: number) => {
                        const getDotColor = (source: string) => {
                          switch (source) {
                            case 'google':
                              return 'bg-blue-500';
                            case 'lifeboard':
                              return 'bg-green-500';
                            default:
                              return 'bg-indigo-500';
                          }
                        };
                        
                        return (
                          <span key={i} className={`w-1.5 h-1.5 rounded-full ${getDotColor(ev.source)}`}></span>
                        );
                      })
                    )}
                    {dayEvents.length > 3 && (
                      <span className="text-xs text-gray-500">+{dayEvents.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {selectedModalDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg w-96 max-w-[90%] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">{format(parseISO(selectedModalDate), 'MMMM d, yyyy')}</h3>
              <button
                onClick={() => setSelectedModalDate(null)}
                className="text-gray-400 hover:text-gray-600 rounded-md focus:outline-none"
              >
                &times;
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-auto">
              {(eventsByDate[selectedModalDate] ?? []).map((ev: DayEvent, idx: number) => {
                const getDotColor = (source: string) => {
                  switch (source) {
                    case 'google':
                      return 'bg-blue-500';
                    case 'lifeboard':
                      return 'bg-green-500';
                    default:
                      return 'bg-indigo-500';
                  }
                };
                
                const getSourceLabel = (source: string) => {
                  switch (source) {
                    case 'google':
                      return 'Google Calendar';
                    case 'lifeboard':
                      return 'Hourly Schedule';
                    case 'todoist':
                      return 'Todoist';
                    default:
                      return source;
                  }
                };
                
                return (
                  <div key={idx} className="flex items-start gap-2">
                    <span className={`mt-1 w-2 h-2 rounded-full ${getDotColor(ev.source)}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{ev.title}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                          {getSourceLabel(ev.source)}
                        </span>
                        {ev.time && (
                          <span>
                            {ev.allDay ? 'All day' : format(new Date(ev.time), 'h:mm a')}
                            {ev.duration && ev.source === 'lifeboard' && (
                              <span className="ml-1">({ev.duration}min)</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {(eventsByDate[selectedModalDate]?.length ?? 0) === 0 && (
                <p className="text-sm text-gray-500">No events</p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
