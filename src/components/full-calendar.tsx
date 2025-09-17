"use client";

import { useState, useEffect, useCallback } from "react";
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
import type { RepeatOption } from "@/hooks/use-tasks";
import { Droppable, Draggable } from "@hello-pangea/dnd";

type CalendarView = 'month' | 'week' | 'day';

const REPEAT_OPTIONS: { value: RepeatOption; label: string }[] = [
  { value: 'none', label: 'Do not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
];

const REPEAT_LABELS: Record<Exclude<RepeatOption, 'none'>, string> = {
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekly: 'Every week',
  monthly: 'Every month',
};

const getRepeatLabel = (value?: RepeatOption | null) => {
  if (!value || value === 'none') return null;
  return REPEAT_LABELS[value];
};

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

interface DayEvent { source: 'google' | 'todoist' | 'lifeboard'; title: string; time?: string; allDay?: boolean; taskId?: string; duration?: number; repeatRule?: RepeatOption; }

interface CalendarTaskMovedDetail {
  taskId: string;
  fromDate: string;
  toDate: string;
  title?: string;
  time?: string;
  hourSlot?: string | null;
  allDay?: boolean;
  duration?: number;
  repeatRule?: RepeatOption | null;
}

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
  const [formRepeat, setFormRepeat] = useState<RepeatOption>('none');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  
  // Get tasks from context
  const { allTasks, scheduledTasks, batchUpdateTasks, createTask } = useTasksContext();
  
  // Use calendar sync hook
  const { getEventsForDate } = useCalendarTaskSync(allTasks, currentDate);

  const resolveTaskById = useCallback((taskId?: string | null) => {
    if (!taskId) return undefined;
    const lookup = taskId.toString();
    return allTasks.find((t) => t.id?.toString?.() === lookup);
  }, [allTasks]);

  const extractHourLabel = useCallback((hourSlot?: string | null) => {
    if (!hourSlot) return '';
    return hourSlot.replace(/^hour-/, '');
  }, []);

  const isoToHourLabel = useCallback((iso?: string | null) => {
    if (!iso) return '';
    try {
      return format(new Date(iso), 'h a').replace(' ', '');
    } catch (error) {
      console.error('Failed to parse ISO time for label', error);
      return '';
    }
  }, []);

  const deriveRepeatOption = useCallback((task: any): RepeatOption => {
    if (!task) return 'none';
    if (task.repeatRule) return task.repeatRule as RepeatOption;
    if (task.due?.is_recurring && typeof task.due?.string === 'string') {
      const normalized = task.due.string.trim().toLowerCase().replace(/\s+starting\s+.+$/, '');
      switch (normalized) {
        case 'every day':
        case 'daily':
          return 'daily';
        case 'every week':
        case 'weekly':
          return 'weekly';
        case 'every weekday':
        case 'weekdays':
        case 'every workday':
          return 'weekdays';
        case 'every month':
        case 'monthly':
          return 'monthly';
      }
    }
    return 'none';
  }, []);

  const openTaskModal = useCallback((
    task: any | undefined,
    dateStr: string,
    options: { fallbackTitle?: string; fallbackHourLabel?: string; fallbackTaskId?: string; fallbackRepeat?: RepeatOption | null } = {}
  ) => {
    const fallbackDate = dateStr || task?.due?.date || format(currentDate, 'yyyy-MM-dd');
    const bucketDefault = selectedBucket || availableBuckets[0] || '';
    const hourLabel = extractHourLabel(task?.hourSlot) || extractHourLabel(options.fallbackHourLabel) || '';
    const repeatDefault = task ? deriveRepeatOption(task) : (options.fallbackRepeat ?? 'none');

    setFormContent(task?.content ?? options.fallbackTitle ?? '');
    setFormBucket(task?.bucket ?? bucketDefault ?? '');
    setFormTime(hourLabel);
    setFormRepeat(repeatDefault);
    setAddTaskDate(fallbackDate);
    setEditTaskId(task?.id?.toString?.() ?? options.fallbackTaskId ?? null);
    setSelectedModalDate(null);
    setIsSubmitting(false);
    setIsAddModalOpen(true);
  }, [availableBuckets, currentDate, deriveRepeatOption, extractHourLabel, selectedBucket]);

  const openTaskEditor = useCallback((event: DayEvent, dateStr: string) => {
    if (event.source !== 'lifeboard' || !event.taskId) return;
    const task = resolveTaskById(event.taskId);
    const targetDate = dateStr || task?.due?.date || format(currentDate, 'yyyy-MM-dd');
    const fallbackHour = isoToHourLabel(event.time);
    openTaskModal(task, targetDate, {
      fallbackTitle: event.title,
      fallbackHourLabel: fallbackHour,
      fallbackTaskId: event.taskId,
      fallbackRepeat: event.repeatRule ?? null,
    });
  }, [currentDate, isoToHourLabel, openTaskModal, resolveTaskById]);

  const openTaskEditorById = useCallback((taskId: string, metadata?: { hourSlot?: string | null; plannerDate?: string | null }) => {
    const task = resolveTaskById(taskId);
    const fallbackHour = extractHourLabel(metadata?.hourSlot);
    const dateStr = metadata?.plannerDate || task?.due?.date || format(currentDate, 'yyyy-MM-dd');
    openTaskModal(task, dateStr, {
      fallbackHourLabel: fallbackHour,
      fallbackTaskId: taskId,
      fallbackRepeat: task?.repeatRule ?? null,
    });
  }, [currentDate, extractHourLabel, openTaskModal, resolveTaskById]);

  const closeTaskModal = useCallback(() => {
    setIsAddModalOpen(false);
    setEditTaskId(null);
    setIsSubmitting(false);
    setFormContent('');
    setFormTime('');
    setFormRepeat('none');
    setAddTaskDate(null);
    if (selectedBucket) setFormBucket(selectedBucket);
    else if (availableBuckets.length > 0) setFormBucket(availableBuckets[0]);
    else setFormBucket('');
  }, [availableBuckets, selectedBucket]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<CalendarTaskMovedDetail>;
      const detail = custom.detail;
      if (!detail?.taskId || !detail.fromDate || !detail.toDate) return;

      setEventsByDate((prev) => {
        const next = { ...prev } as Record<string, DayEvent[]>;

        const sourceList = next[detail.fromDate] ? [...next[detail.fromDate]] : [];
        let movedEvent: DayEvent | undefined;

        if (sourceList.length > 0) {
          const index = sourceList.findIndex((ev) => ev.taskId === detail.taskId);
          if (index >= 0) {
            movedEvent = sourceList[index];
            sourceList.splice(index, 1);
          }
        }

        if (sourceList.length > 0) {
          next[detail.fromDate] = sourceList;
        } else {
          delete next[detail.fromDate];
        }

        const repeatRule = detail.repeatRule ?? movedEvent?.repeatRule;

        if (!movedEvent) {
          movedEvent = {
            source: 'lifeboard',
            title: detail.title ?? 'Task',
            time: detail.time,
            allDay: detail.allDay ?? !detail.hourSlot,
            taskId: detail.taskId,
            duration: detail.duration ?? 60,
            repeatRule: repeatRule ?? undefined,
          };
        } else {
          movedEvent = {
            ...movedEvent,
            title: detail.title ?? movedEvent.title,
            time: detail.time ?? movedEvent.time,
            allDay: detail.allDay ?? movedEvent.allDay,
            duration: detail.duration ?? movedEvent.duration,
            repeatRule: repeatRule ?? movedEvent.repeatRule,
          };
        }

        const destinationList = [...(next[detail.toDate] || [])];
        destinationList.push(movedEvent);
        destinationList.sort((a, b) => {
          if (a.time && b.time) return a.time.localeCompare(b.time);
          if (a.time) return -1;
          if (b.time) return 1;
          const titleA = a.title ?? '';
          const titleB = b.title ?? '';
          return titleA.localeCompare(titleB);
        });
        next[detail.toDate] = destinationList;

        return next;
      });
    };

    window.addEventListener('lifeboard:calendar-task-moved', handler as EventListener);
    return () => window.removeEventListener('lifeboard:calendar-task-moved', handler as EventListener);
  }, []);

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

  const getDateRange = useCallback(() => {
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
  }, [currentDate, view]);

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
              duration: event.duration,
              repeatRule: event.repeatRule,
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
  }, [currentDate, view, allTasks, getEventsForDate, getDateRange]);

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
                onTaskOpen={openTaskEditorById}
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
                                setFormRepeat('none');
                                setEditTaskId(null);
                                setIsSubmitting(false);
                                if (selectedBucket) setFormBucket(selectedBucket);
                                else if (availableBuckets.length > 0) setFormBucket(availableBuckets[0]);
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
                                const repeatLabel = getRepeatLabel(ev.repeatRule);
                                const isLifeboardTask = ev.source === 'lifeboard' && !!ev.taskId;
                                const draggableId = isLifeboardTask
                                  ? `lifeboard::${ev.taskId}`
                                  : `event::${dayStr}::${i}`;

                                return (
                                  <Draggable
                                    key={draggableId}
                                    draggableId={draggableId}
                                    index={i}
                                    isDragDisabled={!isLifeboardTask}
                                  >
                                    {(dragProvided, dragSnapshot) => (
                                      <div
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...(isLifeboardTask ? dragProvided.dragHandleProps : {})}
                                        style={dragProvided.draggableProps.style}
                                        role={isLifeboardTask ? 'button' : undefined}
                                        tabIndex={isLifeboardTask ? 0 : undefined}
                                        onClick={(event) => {
                                          if (isLifeboardTask && ev.taskId) {
                                            event.stopPropagation();
                                            const target = event.currentTarget as HTMLElement | null;
                                            if (target && typeof target.blur === 'function') target.blur();
                                            openTaskEditor(ev, dayStr);
                                          }
                                        }}
                                        onKeyDown={(event) => {
                                          if (!isLifeboardTask || !ev.taskId) return;
                                          if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            const target = event.currentTarget as HTMLElement | null;
                                            if (target && typeof target.blur === 'function') target.blur();
                                            openTaskEditor(ev, dayStr);
                                          }
                                        }}
                                        className={`p-2 rounded transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${styles.container} ${dragSnapshot.isDragging ? 'shadow-lg ring-2 ring-emerald-300' : ''}`}
                                        title={`${ev.title}${timeDisplay ? ` at ${timeDisplay}` : ''}${ev.duration ? ` (${ev.duration}min)` : ''}`}
                                        data-task-id={ev.taskId}
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
                                            {repeatLabel && (
                                              <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">
                                                <span>↻</span>
                                                <span className="truncate">{repeatLabel}</span>
                                              </div>
                                            )}
                                          </div>
                                          <span className={`text-xs ${styles.badge} flex-shrink-0`}>
                                            {ev.source === 'google' ? 'G' : ev.source === 'lifeboard' ? 'L' : 'T'}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
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
                                setFormRepeat('none');
                                setEditTaskId(null);
                                setIsSubmitting(false);
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
                                const repeatLabel = getRepeatLabel(ev.repeatRule);
                                const isLifeboardTask = ev.source === 'lifeboard' && !!ev.taskId;
                                const draggableId = isLifeboardTask
                                  ? `lifeboard::${ev.taskId}`
                                  : `event::${dayStr}::${i}`;

                                return (
                                  <Draggable
                                    key={draggableId}
                                    draggableId={draggableId}
                                    index={i}
                                    isDragDisabled={!isLifeboardTask}
                                  >
                                    {(dragProvided, dragSnapshot) => (
                                      <div 
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...(isLifeboardTask ? dragProvided.dragHandleProps : {})}
                                        style={dragProvided.draggableProps.style}
                                        role={isLifeboardTask ? 'button' : undefined}
                                        tabIndex={isLifeboardTask ? 0 : undefined}
                                        onClick={(event) => {
                                          if (isLifeboardTask && ev.taskId) {
                                            event.stopPropagation();
                                            const target = event.currentTarget as HTMLElement | null;
                                            if (target && typeof target.blur === 'function') target.blur();
                                            openTaskEditor(ev, dayStr);
                                          }
                                        }}
                                        onKeyDown={(event) => {
                                          if (!isLifeboardTask || !ev.taskId) return;
                                          if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            const target = event.currentTarget as HTMLElement | null;
                                            if (target && typeof target.blur === 'function') target.blur();
                                            openTaskEditor(ev, dayStr);
                                          }
                                        }}
                                        className={`p-1.5 rounded text-xs transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${styles.container} ${dragSnapshot.isDragging ? 'shadow-lg ring-2 ring-emerald-300' : ''}`}
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
                                            {repeatLabel && (
                                              <div className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 uppercase tracking-wide">
                                                <span>↻</span>
                                                <span className="truncate">{repeatLabel}</span>
                                              </div>
                                            )}
                                          </div>
                                          <span className={`text-[10px] ${styles.badge} flex-shrink-0`}>
                                            {ev.source === 'google' ? 'G' : ev.source === 'lifeboard' ? 'L' : 'T'}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
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
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg w-[520px] max-w-[92%] p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{editTaskId ? 'Edit Task' : 'Add Task'}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {addTaskDate ? format(parseISO(addTaskDate), 'EEEE, MMMM d, yyyy') : 'No date selected'}
                </p>
              </div>
              <button className="text-gray-400 hover:text-gray-600" onClick={closeTaskModal}>&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Task</label>
                <input
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="What do you want to do?"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={addTaskDate ?? ''}
                    onChange={(e) => setAddTaskDate(e.target.value || null)}
                  />
                </div>
                <div>
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

              <div className={`grid gap-3 ${availableBuckets.length > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                {availableBuckets.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Category</label>
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
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Repeat</label>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                    value={formRepeat}
                    onChange={(e) => setFormRepeat(e.target.value as RepeatOption)}
                  >
                    {REPEAT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={closeTaskModal}
                >
                  Close
                </button>
                <button
                  className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  disabled={!formContent.trim() || isSubmitting}
                  onClick={async () => {
                    try {
                      setIsSubmitting(true);
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

                      const hourNum = toHourNumber(formTime);
                      const dueDateValue = addTaskDate && addTaskDate.trim() ? addTaskDate : null;

                      if (!editTaskId) {
                        const task = await createTask(
                          formContent.trim(),
                          dueDateValue,
                          hourNum,
                          availableBuckets.length > 0 ? (formBucket || undefined) : undefined,
                          formRepeat
                        );
                        if (task) {
                          setAddTaskDate(dueDateValue ?? null);
                          if (dueDateValue) {
                            setEventsByDate((prev) => {
                              const next = { ...prev } as Record<string, DayEvent[]>;
                              const list = [...(next[dueDateValue] || [])];
                              if (hourNum === undefined) {
                                list.unshift({
                                  source: 'lifeboard',
                                  title: task.content || formContent.trim(),
                                  allDay: true,
                                  taskId: task.id,
                                  repeatRule: formRepeat !== 'none' ? formRepeat : undefined,
                                });
                              } else {
                                const base = parseISO(dueDateValue + 'T00:00:00');
                                base.setHours(hourNum, 0, 0, 0);
                                list.unshift({
                                  source: 'lifeboard',
                                  title: task.content || formContent.trim(),
                                  time: base.toISOString(),
                                  allDay: false,
                                  taskId: task.id,
                                  duration: 60,
                                  repeatRule: formRepeat !== 'none' ? formRepeat : undefined,
                                });
                              }
                              list.sort((a, b) => {
                                if (a.time && b.time) return a.time.localeCompare(b.time);
                                if (a.time) return -1;
                                if (b.time) return 1;
                                const titleA = a.title ?? '';
                                const titleB = b.title ?? '';
                                return titleA.localeCompare(titleB);
                              });
                              next[dueDateValue] = list;
                              return next;
                            });
                          }
                          setEditTaskId(task.id?.toString?.() || String(task.id));
                        }
                      } else {
                        const updates: any = {
                          content: formContent.trim(),
                        };
                        if (availableBuckets.length > 0) {
                          updates.bucket = formBucket || null;
                        }
                        updates.hourSlot = formTime ? `hour-${formTime}` : null;
                        updates.due = dueDateValue ? { date: dueDateValue } : null;
                        updates.repeatRule = formRepeat === 'none' ? null : formRepeat;
                        await batchUpdateTasks([{ taskId: editTaskId, updates }]);
                        closeTaskModal();
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
