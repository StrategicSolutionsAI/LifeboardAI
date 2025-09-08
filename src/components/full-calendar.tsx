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
import { DragDropContext, DropResult, Droppable } from "@hello-pangea/dnd";

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
  availableBuckets?: string[];
  selectedBucket?: string;
  isDragging?: boolean;
  disableInternalDragDrop?: boolean;
}

export default function FullCalendar({ selectedDate: propSelectedDate, onDateChange, availableBuckets = [], selectedBucket, isDragging = false, disableInternalDragDrop = false }: FullCalendarProps = {}) {
  // Initialize current date from localStorage or prop or default to today
  const [currentDate, setCurrentDate] = useState(() => {
    if (propSelectedDate) return propSelectedDate;
    
    if (typeof window !== 'undefined') {
      const savedDate = localStorage.getItem('calendar-selected-date');
      if (savedDate) {
        try {
          return parseISO(savedDate);
        } catch {
          // If invalid date, fall back to today
        }
      }
    }
    return new Date();
  });

  // Persist date changes to localStorage and notify parent
  const handleDateChange = (newDate: Date) => {
    setCurrentDate(newDate);
    if (typeof window !== 'undefined') {
      localStorage.setItem('calendar-selected-date', format(newDate, 'yyyy-MM-dd'));
    }
    onDateChange?.(newDate);
  };
  // Initialize view from localStorage or default to 'day'
  const [view, setView] = useState<CalendarView>(() => {
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem('calendar-view');
      if (savedView && ['month', 'week', 'day'].includes(savedView)) {
        return savedView as CalendarView;
      }
    }
    return 'day';
  });

  // Persist view changes to localStorage
  const handleViewChange = (newView: CalendarView) => {
    setView(newView);
    if (typeof window !== 'undefined') {
      localStorage.setItem('calendar-view', newView);
    }
  };
  const [eventsByDate, setEventsByDate] = useState<Record<string, DayEvent[]>>({});
  const today = new Date();
  const [selectedModalDate, setSelectedModalDate] = useState<string | null>(null);
  
  // Get tasks from context
  const { allTasks, scheduledTasks, batchUpdateTasks } = useTasksContext();
  
  // Use calendar sync hook
  const { getEventsForDate } = useCalendarTaskSync(allTasks, currentDate);

  const nextPeriod = () => {
    const newDate = (() => {
      switch (view) {
        case 'month':
          return addMonths(currentDate, 1);
        case 'week':
          return addWeeks(currentDate, 1);
        case 'day':
          return addDays(currentDate, 1);
        default:
          return currentDate;
      }
    })();
    handleDateChange(newDate);
  };

  const prevPeriod = () => {
    const newDate = (() => {
      switch (view) {
        case 'month':
          return subMonths(currentDate, 1);
        case 'week':
          return addWeeks(currentDate, -1);
        case 'day':
          return addDays(currentDate, -1);
        default:
          return currentDate;
      }
    })();
    handleDateChange(newDate);
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

  // Use drag state from props or local state
  const [localDragging, setLocalDragging] = useState(false);
  const dragState = isDragging || localDragging;

  // Unified drag and drop handler for calendar day view
  const handleDragEnd = (result: DropResult) => {
    // Ignore drops if a resize operation is active
    if (typeof document !== 'undefined' && document.body.classList.contains('lb-resizing')) {
      setLocalDragging(false);
      return;
    }
    setLocalDragging(false);
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // Helper functions
    const isHour = (id: string) => id.startsWith('hour-');
    const hourKey = (id: string) => id.replace('hour-', '');

    // Handle moves between hour slots in day view
    if (isHour(source.droppableId) && isHour(destination.droppableId)) {
      // Hour slot → Different hour slot: Update the hourSlot (keep full 'hour-<time>' format for consistency)
      const dstHour = destination.droppableId; // e.g., 'hour-7AM'
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
    <div className="w-full max-w-none mx-4 bg-white/98 backdrop-blur-md border border-gray-200/70 rounded-2xl shadow-lg overflow-hidden">
      {/* Enhanced Header with Modern Navigation */}
      <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200/80">
        <div className="flex items-center space-x-3">
          <button
            onClick={prevPeriod}
            className="p-2.5 rounded-xl hover:bg-gray-100/80 text-gray-600 hover:text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            aria-label="Previous period"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={() => {
              handleDateChange(new Date());
            }}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            Today
          </button>
          
          <button
            onClick={nextPeriod}
            className="p-2.5 rounded-xl hover:bg-gray-100/80 text-gray-600 hover:text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            aria-label="Next period"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center space-x-6">
          <h2 className="font-bold tracking-tight text-3xl text-gray-900">
            {getHeaderTitle()}
          </h2>
          
          {/* Enhanced View Selector */}
          <div className="flex items-center bg-gray-100/80 rounded-xl p-1 border border-gray-200/60">
            {(['day', 'week', 'month'] as CalendarView[]).map((viewOption) => (
              <button
                key={viewOption}
                onClick={() => handleViewChange(viewOption)}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  view === viewOption
                    ? 'bg-white shadow-md text-blue-700 border border-blue-200/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                {viewOption.charAt(0).toUpperCase() + viewOption.slice(1)}
              </button>
            ))}
          </div>
        </div>
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
        // Enhanced Day view: Modern HourlyPlanner
        <div className="w-full">
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200/80">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                {format(currentDate, "EEEE, MMMM d, yyyy")}
              </h2>
              <p className="text-sm text-gray-600 mt-2 font-medium">
                Plan your day with precision scheduling
              </p>
            </div>
            
            <div className="p-6">
              <HourlyPlanner 
                className="max-h-[75vh] overflow-y-auto rounded-xl" 
                showTimeIndicator={true}
                allowResize={true}
                availableBuckets={availableBuckets}
                selectedBucket={selectedBucket}
                wrapWithContext={false}
                plannerDate={format(currentDate, 'yyyy-MM-dd')}
              />
            </div>
          </div>
        </div>
      ) : (
        // Enhanced Month and Week views with optimized layouts
        <div className="p-6">
          {view === 'week' ? (
            // Week view: Tall vertical columns to show all events
            <div className="grid grid-cols-7 gap-3 h-[600px]">
              {rows.flat().map((day: Date, idx: number) => {
                const dayStr = day.toISOString().slice(0,10);
                const dayEvents = eventsByDate[dayStr] ?? [];
                const isCurrentMonth = view === 'month' ? isSameMonth(day, currentDate) : true;
                const isToday = isSameDay(day, today);
                
                return (
                  <Droppable key={`droppable-${dayStr}-${idx}`} droppableId={`calendar-day-${dayStr}`}>
                    {(provided, snapshot) => {
                      return (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          onClick={() => dayEvents.length && setSelectedModalDate(dayStr)}
                          className={`
                            h-full cursor-pointer flex flex-col text-sm p-4
                            transition-all duration-200 hover:shadow-lg
                            ${
                              isCurrentMonth 
                                ? "bg-white shadow-md border border-gray-200/80" 
                                : "bg-gray-50/80 text-gray-400 border border-gray-100/50"
                            } 
                            ${
                              isToday 
                                ? "ring-2 ring-blue-500/60 bg-blue-50/90 border-blue-300" 
                                : ""
                            } 
                            ${
                              snapshot.isDraggingOver 
                                ? "bg-blue-100/90 border-blue-400 border-2 shadow-xl ring-2 ring-blue-300/50" 
                                : ""
                            }
                            rounded-xl overflow-hidden
                          `}
                        >
                          {/* Enhanced Week Day Header */}
                          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200/70">
                            <div className="flex flex-col">
                              <span className={`font-bold text-3xl leading-none ${
                                isToday ? 'text-blue-700' : 
                                isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                              }`}>
                                {format(day, "d")}
                              </span>
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
                                {format(day, "EEE")}
                              </span>
                            </div>
                            {dayEvents.length > 0 && (
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-bold text-gray-700 bg-gray-100/80 px-3 py-1 rounded-full border border-gray-300/60 shadow-sm">
                                  {dayEvents.length}
                                </span>
                                <span className="text-[10px] text-gray-500 mt-1 font-medium">
                                  {dayEvents.length === 1 ? 'event' : 'events'}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Scrollable Events Container */}
                          <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                            {dayEvents.length > 0 ? (
                              dayEvents.map((ev: DayEvent, i: number) => {
                                const getEventStyle = (source: string) => {
                                  switch (source) {
                                    case 'google':
                                      return {
                                        container: 'bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-300/60 text-blue-900 hover:from-blue-200 hover:to-blue-100',
                                        time: 'text-blue-700',
                                        dot: 'bg-blue-500',
                                        badge: 'bg-blue-200/80 text-blue-800 border-blue-300/60'
                                      };
                                    case 'lifeboard':
                                      return {
                                        container: 'bg-gradient-to-br from-emerald-100 to-emerald-50 border border-emerald-300/60 text-emerald-900 hover:from-emerald-200 hover:to-emerald-100',
                                        time: 'text-emerald-700',
                                        dot: 'bg-emerald-500',
                                        badge: 'bg-emerald-200/80 text-emerald-800 border-emerald-300/60'
                                      };
                                    default:
                                      return {
                                        container: 'bg-gradient-to-br from-purple-100 to-purple-50 border border-purple-300/60 text-purple-900 hover:from-purple-200 hover:to-purple-100',
                                        time: 'text-purple-700',
                                        dot: 'bg-purple-500',
                                        badge: 'bg-purple-200/80 text-purple-800 border-purple-300/60'
                                      };
                                  }
                                };
                                
                                const styles = getEventStyle(ev.source);
                                const timeDisplay = ev.time ? format(new Date(ev.time), 'h:mm a') : '';
                                
                                return (
                                  <div 
                                    key={i} 
                                    className={`
                                      p-3 rounded-xl border-l-4 transition-all duration-300 shadow-sm hover:shadow-md 
                                      transform hover:-translate-y-1 hover:scale-[1.02] cursor-pointer group
                                      ${styles.container}
                                    `}
                                  >
                                    {/* Event Header */}
                                    <div className="flex items-start justify-between mb-2">
                                      <div className={`w-2.5 h-2.5 rounded-full mt-0.5 shadow-sm ${styles.dot}`} />
                                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shadow-sm ${styles.badge}`}>
                                        {ev.source === 'google' ? 'Google' : ev.source === 'lifeboard' ? 'Scheduled' : 'Task'}
                                      </span>
                                    </div>
                                    
                                    {/* Event Time */}
                                    {timeDisplay && (
                                      <div className={`font-bold mb-2 text-base ${styles.time}`}>
                                        {timeDisplay}
                                      </div>
                                    )}
                                    
                                    {/* Event Title */}
                                    <div className="font-bold text-sm mb-2 line-clamp-4 leading-snug group-hover:line-clamp-none transition-all">
                                      {ev.title}
                                    </div>
                                    
                                    {/* Event Meta Info */}
                                    <div className="flex items-center gap-2 flex-wrap mt-3">
                                      {ev.duration && ev.source === 'lifeboard' && (
                                        <span className="text-xs font-semibold bg-white/70 text-gray-700 px-2 py-1 rounded-full border border-gray-300/60 shadow-sm">
                                          ⏱️ {ev.duration}min
                                        </span>
                                      )}
                                      {ev.allDay && (
                                        <span className="text-xs font-semibold bg-white/70 text-gray-700 px-2 py-1 rounded-full border border-gray-300/60 shadow-sm">
                                          📅 All day
                                        </span>
                                      )}
                                      {ev.taskId && (
                                        <span className="text-xs font-semibold bg-white/70 text-gray-700 px-2 py-1 rounded-full border border-gray-300/60 shadow-sm">
                                          🎯 Task
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              // Beautiful empty state for days without events
                              <div className="flex-1 flex items-center justify-center text-gray-400">
                                <div className="text-center py-8">
                                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 mx-auto mb-4 flex items-center justify-center shadow-inner">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                  <p className="text-sm font-semibold text-gray-500 mb-1">Free Day</p>
                                  <p className="text-xs text-gray-400">No events scheduled</p>
                                </div>
                              </div>
                            )}
                            
                            {/* Scroll padding */}
                            <div className="h-6"></div>
                          </div>
                          {provided.placeholder}
                        </div>
                      );
                    }}
                  </Droppable>
                );
              })}
            </div>
          ) : (
            // Month view: Compact grid layout
            <div className={`grid grid-cols-7 gap-1 bg-gray-100/50 rounded-xl overflow-hidden`}>
              {rows.flat().map((day: Date, idx: number) => {
                const dayStr = day.toISOString().slice(0,10);
                const dayEvents = eventsByDate[dayStr] ?? [];
                const isCurrentMonth = view === 'month' ? isSameMonth(day, currentDate) : true;
                const isToday = isSameDay(day, today);
                
                return (
                  <Droppable key={`droppable-${dayStr}-${idx}`} droppableId={`calendar-day-${dayStr}`}>
                    {(provided, snapshot) => {
                      return (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          onClick={() => dayEvents.length && setSelectedModalDate(dayStr)}
                          className={`
                            ${getCellSize()} 
                            cursor-pointer flex flex-col items-start justify-start text-sm p-3
                            transition-all duration-200 transform hover:scale-[1.02]
                            ${
                              isCurrentMonth 
                                ? "bg-white shadow-sm border border-gray-200/60 hover:shadow-md" 
                                : "bg-gray-50/80 text-gray-400 border border-gray-100/50"
                            } 
                            ${
                              isToday 
                                ? "ring-2 ring-blue-500/50 bg-blue-50/80 border-blue-200" 
                                : ""
                            } 
                            ${
                              snapshot.isDraggingOver 
                                ? "bg-blue-100/80 border-blue-300 border-2 shadow-lg scale-105" 
                                : ""
                            }
                            rounded-xl
                          `}
                          style={{
                            minHeight: '130px'
                          }}
                        >
                          {/* Enhanced Date Header */}
                          <div className="flex items-center justify-between w-full mb-2">
                            <span className={`font-bold text-lg ${
                              isToday ? 'text-blue-700' : 
                              isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                            }`}>
                              {format(day, "d")}
                            </span>
                            {dayEvents.length > 0 && (
                              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                {dayEvents.length}
                              </span>
                            )}
                          </div>
                          
                          {/* Enhanced Event Indicators */}
                          {dayEvents.length > 0 && (
                            <div className="w-full space-y-1">
                              {dayEvents.slice(0, 3).map((ev: DayEvent, i: number) => {
                                const getEventBarStyle = (source: string) => {
                                  switch (source) {
                                    case 'google':
                                      return 'bg-gradient-to-r from-blue-400 to-blue-500 border-blue-500';
                                    case 'lifeboard':
                                      return 'bg-gradient-to-r from-emerald-400 to-emerald-500 border-emerald-500';
                                    default:
                                      return 'bg-gradient-to-r from-purple-400 to-purple-500 border-purple-500';
                                  }
                                };
                                
                                return (
                                  <div key={i} className={`h-2.5 rounded-full shadow-sm border ${getEventBarStyle(ev.source)}`} 
                                       title={ev.title} />
                                );
                              })}
                              {dayEvents.length > 3 && (
                                <div className="text-xs text-gray-700 font-bold bg-gradient-to-r from-gray-200 to-gray-300 px-2 py-1 rounded-full text-center border border-gray-400 shadow-sm">
                                  +{dayEvents.length - 3} more
                                </div>
                              )}
                            </div>
                          )}
                          {provided.placeholder}
                        </div>
                      );
                    }}
                  </Droppable>
                );
              })}
            </div>
          )}
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
