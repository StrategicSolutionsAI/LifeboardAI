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
  // Hover-add modal state
  const [addTaskDate, setAddTaskDate] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [formContent, setFormContent] = useState<string>("");
  const [formBucket, setFormBucket] = useState<string>(selectedBucket || (availableBuckets[0] || ""));
  const [formTime, setFormTime] = useState<string>(""); // '' = no time
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  
  // Get tasks from context
  const { allTasks, scheduledTasks, batchUpdateTasks, createTask } = useTasksContext();
  
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

  // Keep default bucket in sync when selectedBucket/availableBuckets change
  useEffect(() => {
    if (selectedBucket) setFormBucket(selectedBucket);
    else if (availableBuckets.length > 0) setFormBucket((prev) => prev || availableBuckets[0]);
  }, [selectedBucket, availableBuckets]);

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
    <div className="w-full max-w-none mx-2 sm:mx-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Clean Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-3 bg-gray-50/50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button
            onClick={prevPeriod}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            Today
          </button>
          
          <button
            onClick={nextPeriod}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            aria-label="Next period"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center gap-2 sm:space-x-3">
          <h2 className="font-semibold text-base sm:text-lg text-gray-900">
            {getHeaderTitle()}
          </h2>
          
          {/* Clean View Selector */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200 overflow-x-auto">
            {(['day', 'week', 'month'] as CalendarView[]).map((viewOption) => (
              <button
                key={viewOption}
                onClick={() => handleViewChange(viewOption)}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 ${
                  view === viewOption
                    ? 'bg-white shadow-sm text-blue-600 font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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
        <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-2 px-3">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
            <div key={i} className="py-2 font-medium">
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
        // Enhanced Month and Week views with optimized layouts for maximum density
        <div className="p-2">
          {view === 'week' ? (
            // Week view: Clean, professional layout
            <div className="grid grid-cols-7 gap-1 h-[70vh] min-h-[500px] bg-gray-50 rounded-lg overflow-hidden p-1">
              {rows.flat().map((day: Date, idx: number) => {
                const dayStr = day.toISOString().slice(0,10);
                const dayEvents = eventsByDate[dayStr] ?? [];
                const isCurrentMonth = true; // Always show as current month in week view
                const isToday = isSameDay(day, today);
                
                return (
                  <Droppable key={`droppable-${dayStr}-${idx}`} droppableId={`calendar-day-${dayStr}`}>
                    {(provided, snapshot) => {
                      return (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('.lb-day-add')) return;
                            if (dayEvents.length) setSelectedModalDate(dayStr);
                          }}
                          className={`
                            relative group h-full cursor-pointer flex flex-col text-sm p-3
                            transition-all duration-200 hover:shadow-md
                            ${
                              isCurrentMonth 
                                ? "bg-white shadow-sm border border-gray-200/60" 
                                : "bg-gray-50 text-gray-400 border border-gray-100"
                            } 
                            ${
                              isToday 
                                ? "ring-2 ring-blue-500 bg-blue-50 border-blue-200" 
                                : ""
                            } 
                            ${
                              snapshot.isDraggingOver 
                                ? "bg-blue-100 ring-2 ring-blue-400 shadow-lg" 
                                : ""
                            }
                            rounded-lg overflow-hidden
                          `}
                        >
                          {/* Clean Day Header */}
                          <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                            <span className={`font-semibold text-lg ${
                              isToday ? 'text-blue-600' : 
                              isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                            }`}>
                              {format(day, "d")}
                            </span>
                            {dayEvents.length > 0 && (
                              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                                {dayEvents.length}
                              </span>
                            )}
                            {/* Hover add button */}
                            <button
                              className="lb-day-add hidden group-hover:flex items-center gap-1 absolute top-2 right-2 text-gray-600 hover:text-gray-900 text-xs font-medium px-2 py-1 rounded bg-white/80 hover:bg-white border border-gray-200 shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddTaskDate(dayStr);
                                setFormContent("");
                                setFormTime("");
                                setEditTaskId(null);
                                setIsAddModalOpen(true);
                              }}
                              title="Add task"
                            >
                              + Add
                            </button>
                          </div>
                          
                          {/* Events Container */}
                          <div className="flex-1 overflow-y-auto space-y-2">
                            {/* No inline creation here – handled by hover modal */}
                            {dayEvents.length > 0 ? (
                              dayEvents.map((ev: DayEvent, i: number) => {
                                const getEventStyle = (source: string) => {
                                  switch (source) {
                                    case 'google':
                                      return {
                                        container: 'bg-blue-50 border-l-4 border-blue-400 text-blue-900 hover:bg-blue-100',
                                        time: 'text-blue-600',
                                        dot: 'bg-blue-400',
                                        badge: 'text-blue-600'
                                      };
                                    case 'lifeboard':
                                      return {
                                        container: 'bg-emerald-50 border-l-4 border-emerald-400 text-emerald-900 hover:bg-emerald-100',
                                        time: 'text-emerald-600',
                                        dot: 'bg-emerald-400',
                                        badge: 'text-emerald-600'
                                      };
                                    default:
                                      return {
                                        container: 'bg-purple-50 border-l-4 border-purple-400 text-purple-900 hover:bg-purple-100',
                                        time: 'text-purple-600',
                                        dot: 'bg-purple-400',
                                        badge: 'text-purple-600'
                                      };
                                  }
                                };
                                
                                const styles = getEventStyle(ev.source);
                                const timeDisplay = ev.time ? format(new Date(ev.time), 'h:mm a') : '';
                                
                                return (
                                  <div 
                                    key={i} 
                                    className={`p-2 rounded transition-colors duration-200 cursor-pointer ${styles.container}`}
                                    title={`${ev.title}${timeDisplay ? ` at ${timeDisplay}` : ''}${ev.duration ? ` (${ev.duration}min)` : ''}`}
                                  >
                                    <div className="flex items-start gap-2">
                                      <div className={`w-2 h-2 rounded-full ${styles.dot} flex-shrink-0 mt-1`} />
                                      <div className="flex-1 min-w-0">
                                        {timeDisplay && (
                                          <div className={`text-xs font-medium ${styles.time} mb-1`}>
                                            {timeDisplay}
                                          </div>
                                        )}
                                        <div className="text-sm font-medium truncate">
                                          {ev.title}
                                        </div>
                                      </div>
                                      <span className={`text-xs ${styles.badge} flex-shrink-0`}>
                                        {ev.source === 'google' ? 'G' : ev.source === 'lifeboard' ? 'L' : 'T'}
                                      </span>
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
                            <div className="h-4"></div>
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
            // Month view: Clean grid layout
            <div className={`grid grid-cols-7 gap-2 bg-gray-50 rounded-lg overflow-hidden p-3`}>
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
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('.lb-day-add')) return;
                            if (dayEvents.length) setSelectedModalDate(dayStr);
                          }}
                          className={`
                            ${getCellSize()} 
                            relative group cursor-pointer flex flex-col items-start justify-start text-sm p-3
                            transition-all duration-200 hover:shadow-md
                            ${
                              isCurrentMonth 
                                ? "bg-white shadow-sm border border-gray-200 hover:shadow-md" 
                                : "bg-gray-100 text-gray-400 border border-gray-200"
                            } 
                            ${
                              isToday 
                                ? "ring-2 ring-blue-500 bg-blue-50 border-blue-200" 
                                : ""
                            } 
                            ${
                              snapshot.isDraggingOver 
                                ? "bg-blue-100 ring-2 ring-blue-400 shadow-lg" 
                                : ""
                            }
                            rounded-lg
                          `}
                          style={{
                            minHeight: '120px'
                          }}
                        >
                          {/* Clean Date Header */}
                          <div className="flex items-center justify-between w-full mb-2">
                            <span className={`font-semibold text-lg ${
                              isToday ? 'text-blue-600' : 
                              isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                            }`}>
                              {format(day, "d")}
                            </span>
                            {dayEvents.length > 0 && (
                              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                                {dayEvents.length}
                              </span>
                            )}
                            {/* Hover add button */}
                            <button
                              className="lb-day-add hidden group-hover:flex items-center gap-1 absolute top-2 right-2 text-gray-600 hover:text-gray-900 text-xs font-medium px-2 py-0.5 rounded bg-white/80 hover:bg-white border border-gray-200 shadow-sm"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setAddTaskDate(dayStr);
                                setFormContent("");
                                setFormTime("");
                                setEditTaskId(null);
                                setIsAddModalOpen(true);
                              }}
                              title="Add task"
                            >
                              + Add
                            </button>
                          </div>
                          
                          {/* Clean Event Cards (same as week view) */}
                          {/* No inline creation here – handled by hover modal */}
                          {dayEvents.length > 0 && (
                            <div className="w-full space-y-1">
                              {dayEvents.slice(0, 3).map((ev: DayEvent, i: number) => {
                                const getEventStyle = (source: string) => {
                                  switch (source) {
                                    case 'google':
                                      return {
                                        container: 'bg-blue-50 border-l-4 border-blue-400 text-blue-900 hover:bg-blue-100',
                                        time: 'text-blue-600',
                                        dot: 'bg-blue-400',
                                        badge: 'text-blue-600'
                                      };
                                    case 'lifeboard':
                                      return {
                                        container: 'bg-emerald-50 border-l-4 border-emerald-400 text-emerald-900 hover:bg-emerald-100',
                                        time: 'text-emerald-600',
                                        dot: 'bg-emerald-400',
                                        badge: 'text-emerald-600'
                                      };
                                    default:
                                      return {
                                        container: 'bg-purple-50 border-l-4 border-purple-400 text-purple-900 hover:bg-purple-100',
                                        time: 'text-purple-600',
                                        dot: 'bg-purple-400',
                                        badge: 'text-purple-600'
                                      };
                                  }
                                };
                                
                                const styles = getEventStyle(ev.source);
                                const timeDisplay = ev.time ? format(new Date(ev.time), 'h:mm a') : '';
                                
                                return (
                                  <div 
                                    key={i} 
                                    className={`p-1.5 rounded text-xs transition-colors duration-200 cursor-pointer ${styles.container}`}
                                    title={`${ev.title}${timeDisplay ? ` at ${timeDisplay}` : ''}${ev.duration ? ` (${ev.duration}min)` : ''}`}
                                  >
                                    <div className="flex items-start gap-1.5">
                                      <div className={`w-1.5 h-1.5 rounded-full ${styles.dot} flex-shrink-0 mt-0.5`} />
                                      <div className="flex-1 min-w-0">
                                        {timeDisplay && (
                                          <div className={`text-[10px] font-medium ${styles.time} mb-0.5`}>
                                            {timeDisplay.replace(' ', '').toLowerCase()}
                                          </div>
                                        )}
                                        <div className="text-xs font-medium truncate">
                                          {ev.title.length > 25 ? ev.title.substring(0, 25) + '...' : ev.title}
                                        </div>
                                      </div>
                                      <span className={`text-[10px] ${styles.badge} flex-shrink-0`}>
                                        {ev.source === 'google' ? 'G' : ev.source === 'lifeboard' ? 'L' : 'T'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                              {dayEvents.length > 3 && (
                                <div className="text-[10px] text-gray-600 font-medium bg-gray-100 px-1.5 py-1 rounded text-center">
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
              <h3 className="text-lg font-medium">{selectedModalDate ? format(parseISO(selectedModalDate), 'MMMM d, yyyy') : 'Event Details'}</h3>
              <button
                onClick={() => setSelectedModalDate(null)}
                className="text-gray-400 hover:text-gray-600 rounded-md focus:outline-none"
              >
                &times;
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-auto">
              {(eventsByDate[selectedModalDate || ''] ?? []).map((ev: DayEvent, idx: number) => {
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
              {(eventsByDate[selectedModalDate || '']?.length ?? 0) === 0 && (
                <p className="text-sm text-gray-500">No events</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Task Modal */}
      {isAddModalOpen && addTaskDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg w-[520px] max-w-[92%] p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{editTaskId ? 'Edit Task' : 'Add Task'}</h3>
                <p className="text-xs text-gray-500 mt-1">{format(parseISO(addTaskDate), 'EEEE, MMMM d, yyyy')}</p>
              </div>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => { setIsAddModalOpen(false); setEditTaskId(null); }}>&times;</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Task</label>
                <input
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="What do you want to do?"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                {availableBuckets.length > 0 && (
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">Bucket</label>
                    <select
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                      value={formBucket}
                      onChange={(e) => setFormBucket(e.target.value)}
                    >
                      {availableBuckets.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">Time (optional)</label>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                  >
                    <option value="">No time</option>
                    {['7AM','8AM','9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM','9PM'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() => { setIsAddModalOpen(false); setEditTaskId(null); }}
                >
                  Close
                </button>
                <button
                  className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  disabled={!formContent.trim() || isSubmitting}
                  onClick={async () => {
                    if (!addTaskDate) return;
                    try {
                      setIsSubmitting(true);
                      // Helper: convert time label to hour number
                      const toHourNumber = (label: string): number | undefined => {
                        if (!label) return undefined;
                        const m = label.match(/^(\d{1,2})(AM|PM)$/);
                        if (!m) return undefined;
                        let hh = parseInt(m[1], 10);
                        const ampm = m[2];
                        if (ampm === 'PM' && hh !== 12) hh += 12;
                        if (ampm === 'AM' && hh === 12) hh = 0;
                        return hh;
                      };

                      if (!editTaskId) {
                        // Create then remain open in edit mode
                        const hourNum = toHourNumber(formTime);
                        const task = await createTask(formContent.trim(), addTaskDate, hourNum, formBucket || undefined);
                        if (task) {
                          // Optimistic event add: all-day or lifeboard timed
                          setEventsByDate((prev) => {
                            const next = { ...prev } as Record<string, DayEvent[]>;
                            const list = [...(next[addTaskDate] || [])];
                            if (hourNum === undefined) {
                              list.unshift({ source: 'todoist', title: task.content || formContent.trim(), allDay: true, taskId: task.id });
                            } else {
                              // Build ISO time for display
                              const base = parseISO(addTaskDate + 'T00:00:00');
                              base.setHours(hourNum, 0, 0, 0);
                              list.unshift({ source: 'lifeboard', title: task.content || formContent.trim(), time: base.toISOString(), allDay: false, taskId: task.id, duration: 60 });
                            }
                            next[addTaskDate] = list;
                            return next;
                          });
                          setEditTaskId(task.id?.toString?.() || String(task.id));
                        }
                      } else {
                        // Save edits
                        const updates: any = {};
                        updates.content = formContent.trim();
                        if (formBucket) updates.bucket = formBucket;
                        if (formTime) updates.hourSlot = `hour-${formTime}`; else updates.hourSlot = null as any;
                        await batchUpdateTasks([{ taskId: editTaskId, updates }]);
                        setIsAddModalOpen(false);
                        setEditTaskId(null);
                      }
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  {editTaskId ? (isSubmitting ? 'Saving…' : 'Save changes') : (isSubmitting ? 'Creating…' : 'Create task')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
