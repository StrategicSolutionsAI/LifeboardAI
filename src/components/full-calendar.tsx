"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Upload } from "lucide-react";
import HourlyPlanner, { HourlyPlannerHandle } from "@/components/hourly-planner";
import { useTasksContext } from "@/contexts/tasks-context";
import type { RepeatOption } from "@/hooks/use-tasks";
import { useDataCache } from "@/hooks/use-data-cache";
import { getBucketColorSync, UNASSIGNED_BUCKET_ID } from "@/lib/bucket-colors";
import { getUserPreferencesClient } from "@/lib/user-preferences";
import { CalendarFileUpload } from "@/components/calendar-file-upload";

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

const normalizeRepeatOption = (value: unknown): RepeatOption | undefined => {
  if (!value) return undefined;
  const normalized = String(value).toLowerCase();
  if (normalized === 'daily' || normalized === 'weekly' || normalized === 'weekdays' || normalized === 'monthly') {
    return normalized as RepeatOption;
  }
  return undefined;
};

const sanitizeBucketName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const UNASSIGNED_BUCKET_LABEL = 'Unassigned';

// Bucket color system for calendar events
const normalizeBucketId = (name?: string | null) => {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : UNASSIGNED_BUCKET_ID;
};

const getBucketEventStyles = (bucketName?: string | null, bucketColors?: Record<string, string>) => {
  if (!bucketName) {
    // Default emerald for no bucket
    return {
      container: 'bg-emerald-50 border-l-4 border-emerald-400 text-emerald-900 hover:bg-emerald-100',
      time: 'text-emerald-600',
      dot: 'bg-emerald-400',
      badge: 'text-emerald-600'
    };
  }

  const bucketId = normalizeBucketId(bucketName);
  const color = getBucketColorSync(bucketId, bucketColors);
  
  // Map hex colors to Tailwind classes for calendar events
  const colorMap: Record<string, any> = {
    "#4F46E5": { // indigo
      container: 'bg-indigo-50 border-l-4 border-indigo-400 text-indigo-900 hover:bg-indigo-100',
      time: 'text-indigo-600',
      dot: 'bg-indigo-400',
      badge: 'text-indigo-600'
    },
    "#22C55E": { // green
      container: 'bg-green-50 border-l-4 border-green-400 text-green-900 hover:bg-green-100',
      time: 'text-green-600',
      dot: 'bg-green-400',
      badge: 'text-green-600'
    },
    "#F97316": { // orange
      container: 'bg-orange-50 border-l-4 border-orange-400 text-orange-900 hover:bg-orange-100',
      time: 'text-orange-600',
      dot: 'bg-orange-400',
      badge: 'text-orange-600'
    },
    "#EC4899": { // pink
      container: 'bg-pink-50 border-l-4 border-pink-400 text-pink-900 hover:bg-pink-100',
      time: 'text-pink-600',
      dot: 'bg-pink-400',
      badge: 'text-pink-600'
    },
    "#14B8A6": { // teal
      container: 'bg-teal-50 border-l-4 border-teal-400 text-teal-900 hover:bg-teal-100',
      time: 'text-teal-600',
      dot: 'bg-teal-400',
      badge: 'text-teal-600'
    },
    "#8B5CF6": { // violet
      container: 'bg-violet-50 border-l-4 border-violet-400 text-violet-900 hover:bg-violet-100',
      time: 'text-violet-600',
      dot: 'bg-violet-400',
      badge: 'text-violet-600'
    },
    "#F59E0B": { // amber
      container: 'bg-amber-50 border-l-4 border-amber-400 text-amber-900 hover:bg-amber-100',
      time: 'text-amber-600',
      dot: 'bg-amber-400',
      badge: 'text-amber-600'
    },
    "#06B6D4": { // cyan
      container: 'bg-cyan-50 border-l-4 border-cyan-400 text-cyan-900 hover:bg-cyan-100',
      time: 'text-cyan-600',
      dot: 'bg-cyan-400',
      badge: 'text-cyan-600'
    },
    "#94A3B8": { // gray (unassigned)
      container: 'bg-gray-50 border-l-4 border-gray-400 text-gray-900 hover:bg-gray-100',
      time: 'text-gray-600',
      dot: 'bg-gray-400',
      badge: 'text-gray-600'
    },
    "#ff52bf": { // pink (custom)
      container: 'bg-pink-50 border-l-4 border-pink-400 text-pink-900 hover:bg-pink-100',
      time: 'text-pink-600',
      dot: 'bg-pink-400',
      badge: 'text-pink-600'
    }
  };
  
  // Check if we have a predefined style for this color
  const predefinedStyle = colorMap[color];
  if (predefinedStyle) {
    return predefinedStyle;
  }

  // For custom colors, return dynamic styles
  return {
    container: 'border-l-4 text-gray-900 hover:opacity-90',
    time: 'text-gray-600',
    dot: 'w-2 h-2 rounded-full',
    badge: 'text-gray-600',
    customColor: color
  };
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

interface DayEvent { source: 'google' | 'todoist' | 'lifeboard' | 'uploaded'; title: string; time?: string; allDay?: boolean; taskId?: string; duration?: number; repeatRule?: RepeatOption; bucket?: string; location?: string; eventId?: string; }

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
  const [bucketColors, setBucketColors] = useState<Record<string, string>>({});
  const [selectedBucketFilters, setSelectedBucketFilters] = useState<string[]>(['all']);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Helper function to toggle bucket filter selection
  const toggleBucketFilter = useCallback((filter: string) => {
    setSelectedBucketFilters(prev => {
      if (filter === 'all') {
        return ['all'];
      }

      const newFilters = prev.filter(f => f !== 'all');

      if (newFilters.includes(filter)) {
        const filtered = newFilters.filter(f => f !== filter);
        return filtered.length === 0 ? ['all'] : filtered;
      } else {
        return [...newFilters, filter];
      }
    });
  }, []);

  // Get display text for selected filters
  const getFilterDisplayText = useCallback(() => {
    if (selectedBucketFilters.includes('all')) {
      return 'All Categories';
    }
    if (selectedBucketFilters.length === 1) {
      const filter = selectedBucketFilters[0];
      return filter === 'google' ? 'Google Calendar' :
             filter === 'uploaded' ? 'Uploaded Calendar' :
             filter === 'unassigned' ? 'Unassigned' : filter;
    }
    return `${selectedBucketFilters.length} selected`;
  }, [selectedBucketFilters]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isFilterDropdownOpen && !target.closest('.bucket-filter-dropdown')) {
        setIsFilterDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterDropdownOpen]);

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
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<{ id: string; title: string } | null>(null);
  const hourlyPlannerRef = useRef<HourlyPlannerHandle | null>(null);
  const [uploadRefreshIndex, setUploadRefreshIndex] = useState(0);

  // Get tasks from context
  const { allTasks, scheduledTasks, batchUpdateTasks, createTask, deleteTask, refetch } = useTasksContext();
  
  // Use calendar sync hook
  const resolveTaskById = useCallback((taskId?: string | null) => {
    if (!taskId) return undefined;
    const lookup = taskId.toString();
    return allTasks.find((t) => t.id?.toString?.() === lookup);
  }, [allTasks]);

  const hourSlotToISO = useCallback((hourSlot: string | undefined, dateStr: string): string | undefined => {
    if (!hourSlot) return undefined;
    const normalized = hourSlot.replace(/^hour-/, '');
    const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/i);
    if (!match) return undefined;
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    const base = new Date(`${dateStr}T00:00:00`);
    base.setHours(hours, minutes, 0, 0);
    return base.toISOString();
  }, []);

  const shouldIncludeTaskOnDate = useCallback((task: any, dateStr: string): boolean => {
    if (!task || task.completed) return false;
    const dueDateStr = task.due?.date;
    if (!dueDateStr) return false;

    if (!task.repeatRule || task.repeatRule === 'none') {
      return dueDateStr === dateStr;
    }

    const target = new Date(`${dateStr}T00:00:00`);
    const due = new Date(`${dueDateStr}T00:00:00`);
    if (target < due) return false;

    const day = target.getDay();
    const dueDay = due.getDay();
    const diffDays = Math.floor((target.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));

    switch (task.repeatRule) {
      case 'daily':
        return true;
      case 'weekdays':
        return day >= 1 && day <= 5;
      case 'weekly':
        return diffDays % 7 === 0 && day === dueDay;
      case 'monthly': {
        const dueDateNum = due.getDate();
        const targetDateNum = target.getDate();
        const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
        if (dueDateNum > daysInTargetMonth) {
          return targetDateNum === daysInTargetMonth;
        }
        return targetDateNum === dueDateNum;
      }
      default:
        return false;
    }
  }, []);

  const buildLifeboardEventsForDate = useCallback((dateStr: string): DayEvent[] => {
    const events: DayEvent[] = [];

    allTasks.forEach((task: any) => {
      if (!shouldIncludeTaskOnDate(task, dateStr)) return;

      // Apply bucket filter - multi-select logic
      if (!selectedBucketFilters.includes('all')) {
        const taskBucket = task.bucket || 'unassigned';
        if (!selectedBucketFilters.includes(taskBucket)) return;
      }

      const repeatRule = task.repeatRule && task.repeatRule !== 'none' ? (task.repeatRule as RepeatOption) : undefined;

      if (task.hourSlot) {
        const isoTime = hourSlotToISO(task.hourSlot, dateStr);
        events.push({
          source: 'lifeboard',
          title: task.content,
          time: isoTime,
          allDay: false,
          taskId: task.id,
          duration: task.duration || 60,
          repeatRule,
          bucket: task.bucket,
        });
      } else {
        events.push({
          source: 'lifeboard',
          title: task.content,
          allDay: true,
          taskId: task.id,
          repeatRule,
          bucket: task.bucket,
        });
      }
    });

    return events;
  }, [allTasks, hourSlotToISO, shouldIncludeTaskOnDate, selectedBucketFilters]);

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
    options: {
      fallbackTitle?: string;
      fallbackHourLabel?: string;
      fallbackTaskId?: string;
      fallbackRepeat?: RepeatOption | null;
      fallbackBucket?: string;
    } = {}
  ) => {
    const fallbackDate = dateStr || task?.due?.date || format(currentDate, 'yyyy-MM-dd');
    const bucketDefault = selectedBucket || availableBuckets[0] || '';
    const hourLabel = extractHourLabel(task?.hourSlot) || extractHourLabel(options.fallbackHourLabel) || '';
    const repeatDefault = task ? deriveRepeatOption(task) : (options.fallbackRepeat ?? 'none');
    const sanitizedTaskBucket = sanitizeBucketName(task?.bucket);
    const sanitizedFallbackBucket = sanitizeBucketName(options.fallbackBucket);
    const sanitizedDefaultBucket = sanitizeBucketName(bucketDefault) ?? '';
    const editingExisting = Boolean(task?.id ?? options.fallbackTaskId);
    const resolvedBucket = sanitizedTaskBucket
      ?? sanitizedFallbackBucket
      ?? (editingExisting ? '' : sanitizedDefaultBucket);

    setFormContent(task?.content ?? options.fallbackTitle ?? '');
    setFormBucket(resolvedBucket);
    setFormTime(hourLabel);
    setFormRepeat(repeatDefault);
    setAddTaskDate(fallbackDate);
    setEditTaskId(task?.id?.toString?.() ?? options.fallbackTaskId ?? null);
    setSelectedModalDate(null);
    setIsSubmitting(false);
    setIsAddModalOpen(true);
  }, [availableBuckets, currentDate, deriveRepeatOption, extractHourLabel, selectedBucket]);

  const openTaskEditor = useCallback((event: DayEvent, dateStr: string) => {
    if (!event.taskId) return;
    const task = resolveTaskById(event.taskId);
    const targetDate = dateStr || task?.due?.date || format(currentDate, 'yyyy-MM-dd');
    const fallbackHour = isoToHourLabel(event.time);
    openTaskModal(task, targetDate, {
      fallbackTitle: event.title,
      fallbackHourLabel: fallbackHour,
      fallbackTaskId: event.taskId,
      fallbackRepeat: event.repeatRule ?? null,
      fallbackBucket: event.bucket,
    });
  }, [currentDate, isoToHourLabel, openTaskModal, resolveTaskById]);

  const ensureTaskForEvent = useCallback(async (eventId: string) => {
    try {
      const resp = await fetch(`/api/calendar/events/${eventId}/ensure-task`, {
        method: 'POST',
        cache: 'no-store',
      });
      if (resp.ok) {
        const payload = await resp.json();
        if (!payload?.taskId) return null;
        return {
          taskId: payload.taskId as string,
          bucket: sanitizeBucketName(payload.bucket),
          repeatRule: normalizeRepeatOption(payload.repeatRule),
        };
      }

      if (resp.status !== 404) {
        console.error('Failed to ensure calendar event has task', resp.status);
        try {
          const errorPayload = await resp.json();
          console.error('Ensure task error payload', errorPayload);
        } catch {}
        return null;
      }

      // Fallback for older deployments where the ensure-task endpoint is unavailable
      const fallbackResp = await fetch('/api/calendar/upload', { cache: 'no-store' });
      if (!fallbackResp.ok) {
        console.error('Fallback calendar fetch failed', fallbackResp.status);
        return null;
      }
      const payload = await fallbackResp.json();
      const events = Array.isArray(payload.events) ? payload.events : [];
      const target = events.find((event: any) => event?.id === eventId);
      if (!target?.task_id) return null;
      return {
        taskId: target.task_id as string,
        bucket: sanitizeBucketName(target.bucket),
        repeatRule: normalizeRepeatOption(target.repeat_rule),
      };
    } catch (error) {
      console.error('Failed to ensure calendar event has task', error);
      return null;
    }
  }, []);

  const openTaskEditorById = useCallback((taskId: string, metadata?: { hourSlot?: string | null; plannerDate?: string | null }) => {
    const task = resolveTaskById(taskId);
    const fallbackHour = extractHourLabel(metadata?.hourSlot);
    const dateStr = metadata?.plannerDate || task?.due?.date || format(currentDate, 'yyyy-MM-dd');
    openTaskModal(task, dateStr, {
      fallbackHourLabel: fallbackHour,
      fallbackTaskId: taskId,
      fallbackRepeat: task?.repeatRule ?? null,
      fallbackBucket: task?.bucket,
    });
  }, [currentDate, extractHourLabel, openTaskModal, resolveTaskById]);

  const openCalendarEvent = useCallback(async (calendarEvent: DayEvent, dateStr: string) => {
    if (calendarEvent.source !== 'lifeboard' && calendarEvent.source !== 'uploaded') {
      return;
    }

    let taskId = calendarEvent.taskId;
    let resolvedBucket = calendarEvent.bucket;
    let resolvedRepeat = calendarEvent.repeatRule;

    const needsTask = !taskId && calendarEvent.source === 'uploaded' && calendarEvent.eventId;

    if (needsTask && calendarEvent.eventId) {
      const ensured = await ensureTaskForEvent(calendarEvent.eventId);
      if (ensured?.taskId) {
        taskId = ensured.taskId;
        resolvedBucket = ensured.bucket ?? resolvedBucket;
        resolvedRepeat = ensured.repeatRule ?? resolvedRepeat;

        setEventsByDate((prev) => {
          const next = { ...prev };
          const dayEvents = next[dateStr];
          if (Array.isArray(dayEvents)) {
            next[dateStr] = dayEvents.map((event) => {
              if (event.eventId === calendarEvent.eventId) {
                return {
                  ...event,
                  taskId,
                  bucket: resolvedBucket,
                  repeatRule: resolvedRepeat,
                  source: 'lifeboard',
                };
              }
              return event;
            });
          }
          return next;
        });

        setUploadRefreshIndex((prev) => prev + 1);
        try {
          await refetch();
        } catch (error) {
          console.error('Failed to refresh tasks after ensuring calendar task', error);
        }
      }
    }

    if (!taskId) {
      return;
    }

    const hydratedEvent: DayEvent = {
      ...calendarEvent,
      taskId,
      bucket: resolvedBucket ?? undefined,
      repeatRule: resolvedRepeat,
      source: 'lifeboard',
    };

    openTaskEditor(hydratedEvent, dateStr);
  }, [ensureTaskForEvent, setEventsByDate, setUploadRefreshIndex, refetch, openTaskEditor]);

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

  const dateRange = useMemo(() => getDateRange(), [getDateRange]);
  const rangeStartMs = dateRange.start.getTime();
  const rangeEndMs = dateRange.end.getTime();

  const googleCacheKey = useMemo(() => {
    const startKey = format(new Date(rangeStartMs), 'yyyy-MM-dd');
    const endKey = format(new Date(rangeEndMs), 'yyyy-MM-dd');
    return `calendar-google-${view}-${startKey}-${endKey}`;
  }, [rangeStartMs, rangeEndMs, view]);

  const googleEventsFetcher = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        timeMin: new Date(rangeStartMs).toISOString(),
        timeMax: new Date(rangeEndMs).toISOString(),
        maxResults: '2500',
      });
      const resp = await fetch(`/api/integrations/google/calendar/events?${params.toString()}`);
      if (!resp.ok) {
        if (resp.status === 401) {
          return [];
        }
        throw new Error(`Failed to fetch Google events: ${resp.status}`);
      }
      const payload = await resp.json();
      return Array.isArray(payload.events) ? payload.events : [];
    } catch (error) {
      console.error('Failed to fetch Google events', error);
      return [];
    }
  }, [rangeStartMs, rangeEndMs]);

  const {
    data: googleEventsRaw,
  } = useDataCache<any[] | null>(googleCacheKey, googleEventsFetcher, {
    ttl: 5 * 60 * 1000,
    prefetch: false,
  });

  const googleEvents = useMemo(() => (Array.isArray(googleEventsRaw) ? googleEventsRaw : []), [googleEventsRaw]);

  // Fetch uploaded calendar events
  const uploadedEventsCacheKey = `uploaded-calendar-events-${uploadRefreshIndex}`;
  const uploadedEventsFetcher = useCallback(async () => {
    try {
      const resp = await fetch('/api/calendar/upload', { cache: 'no-store' });
      if (!resp.ok) {
        if (resp.status === 401) {
          return [];
        }
        throw new Error(`Failed to fetch uploaded events: ${resp.status}`);
      }
      const payload = await resp.json();
      return Array.isArray(payload.events) ? payload.events : [];
    } catch (error) {
      console.error('Failed to fetch uploaded calendar events', error);
      return [];
    }
  }, []);

  const {
    data: uploadedEventsRaw,
  } = useDataCache<any[] | null>(uploadedEventsCacheKey, uploadedEventsFetcher, {
    ttl: 5 * 60 * 1000,
    prefetch: false,
  });

  const uploadedEvents = useMemo(() => (Array.isArray(uploadedEventsRaw) ? uploadedEventsRaw : []), [uploadedEventsRaw]);

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
    if (!isAddModalOpen) return;
    if (editTaskId) return;
    if (selectedBucket) {
      setFormBucket(selectedBucket);
      return;
    }
    if (availableBuckets.length > 0) {
      setFormBucket((prev) => prev || availableBuckets[0]);
    } else {
      setFormBucket('');
    }
  }, [selectedBucket, availableBuckets, isAddModalOpen, editTaskId]);

  // Load bucket colors
  useEffect(() => {
    const loadBucketColors = async () => {
      try {
        const prefs = await getUserPreferencesClient();
        if (prefs?.bucket_colors) {
          setBucketColors(prefs.bucket_colors);
        }
      } catch (error) {
        console.error("Failed to load bucket colors:", error);
      }
    };

    loadBucketColors();

    // Listen for bucket color changes
    const handleBucketColorsChanged = () => {
      loadBucketColors();
    };

    window.addEventListener('bucketColorsChanged', handleBucketColorsChanged);

    return () => {
      window.removeEventListener('bucketColorsChanged', handleBucketColorsChanged);
    };
  }, []);

  useEffect(() => {
    const handleCalendarUploadComplete = () => {
      setUploadRefreshIndex((prev) => prev + 1);
      try {
        refetch();
      } catch (error) {
        console.error('Failed to refetch tasks after calendar upload:', error);
      }
    };

    window.addEventListener('calendar-upload-complete', handleCalendarUploadComplete);
    return () => {
      window.removeEventListener('calendar-upload-complete', handleCalendarUploadComplete);
    };
  }, [refetch]);

  // Legacy bucket label retained for older imports
  const IMPORTED_CALENDAR_BUCKET_NAME = 'Imported Calendar';

  // Build events map whenever data sources change
  useEffect(() => {
    const map: Record<string, DayEvent[]> = {};
    const seenTaskIds = new Set<string>();

    googleEvents.forEach((ev: any) => {
      // Apply bucket filter for Google Calendar events
      if (!selectedBucketFilters.includes('all') && !selectedBucketFilters.includes('google')) {
        return; // Skip Google events when specific buckets are selected (unless 'google' is included)
      }

      const startInfo = ev?.start ?? {};
      const dateStr = startInfo.date ?? (startInfo.dateTime ? startInfo.dateTime.slice(0, 10) : undefined);
      if (!dateStr) return;
      const bucket = map[dateStr] ?? (map[dateStr] = []);
      bucket.push({
        source: 'google',
        title: ev.summary ?? 'Event',
        time: startInfo.dateTime ?? undefined,
        allDay: Boolean(startInfo.date),
      });
    });

    // Add uploaded calendar events
    uploadedEvents.forEach((ev: any) => {
      // Apply bucket filter for uploaded calendar events
      if (!selectedBucketFilters.includes('all') && !selectedBucketFilters.includes('uploaded')) {
        return; // Skip uploaded events when specific buckets are selected (unless 'uploaded' is included)
      }

      // Determine the date for this event
      const dateStr = ev.start_date || (ev.start_time ? ev.start_time.slice(0, 10) : undefined);
      if (!dateStr) return;

      // Check if the event falls within our date range
      const eventDate = new Date(dateStr);
      if (eventDate < new Date(rangeStartMs) || eventDate > new Date(rangeEndMs)) {
        return;
      }

      let resolvedTaskId: string | undefined = ev.task_id ?? undefined;
      let matchedTask: any | undefined;

      if (resolvedTaskId) {
        matchedTask = allTasks.find((task: any) => task.id?.toString?.() === resolvedTaskId);
      }

      if (!matchedTask) {
        const normalizedTitle = (ev.title ?? '').trim().toLowerCase();
        matchedTask = allTasks.find((task: any) => {
          if (resolvedTaskId) {
            return task.id?.toString?.() === resolvedTaskId;
          }
          const bucketName = sanitizeBucketName(task.bucket);
          const isLegacyImportedBucket = bucketName === IMPORTED_CALENDAR_BUCKET_NAME;
          const isUnassigned = !bucketName;
          const isSupabaseTask = task.source === 'supabase';
          if (!isSupabaseTask) return false;
          if (!isUnassigned && !isLegacyImportedBucket) return false;
          if ((task.due?.date ?? '') !== dateStr) return false;
          const taskTitle = (task.content ?? '').trim().toLowerCase();
          return taskTitle === normalizedTitle;
        });
        if (matchedTask?.id && !resolvedTaskId) {
          resolvedTaskId = matchedTask.id?.toString?.() ?? matchedTask.id;
        }
      }

      const resolvedBucket = sanitizeBucketName(matchedTask?.bucket)
        ?? sanitizeBucketName(ev.bucket);
      const resolvedRepeatRule = normalizeRepeatOption(matchedTask?.repeatRule ?? ev.repeat_rule);

      const bucket = map[dateStr] ?? (map[dateStr] = []);
      const taskIdKey = resolvedTaskId ? resolvedTaskId.toString() : undefined;
      if (taskIdKey && seenTaskIds.has(taskIdKey)) {
        return;
      }

      bucket.push({
        source: resolvedTaskId ? 'lifeboard' : 'uploaded',
        title: ev.title ?? 'Uploaded Event',
        time: ev.start_time ?? undefined,
        allDay: ev.all_day || Boolean(ev.start_date),
        location: ev.location ?? undefined,
        taskId: resolvedTaskId,
        bucket: resolvedBucket,
        repeatRule: resolvedRepeatRule,
        eventId: ev.id,
      });

      if (taskIdKey) {
        seenTaskIds.add(taskIdKey);
      }
    });

    let cursor = startOfDay(new Date(rangeStartMs));
    const rangeEndDate = startOfDay(new Date(rangeEndMs));

    while (cursor.getTime() <= rangeEndDate.getTime()) {
      const dateStr = format(cursor, 'yyyy-MM-dd');
      const lifeboardEvents = buildLifeboardEventsForDate(dateStr);
      if (lifeboardEvents.length > 0) {
        const bucket = map[dateStr] ?? (map[dateStr] = []);
        lifeboardEvents.forEach(event => {
          const taskIdKey = event.taskId ? event.taskId.toString() : undefined;
          if (taskIdKey && seenTaskIds.has(taskIdKey)) {
            return;
          }
          bucket.push(event);
          if (taskIdKey) {
            seenTaskIds.add(taskIdKey);
          }
        });
      }
      cursor = addDays(cursor, 1);
    }

    setEventsByDate(map);
  }, [
    googleEvents,
    uploadedEvents,
    rangeStartMs,
    rangeEndMs,
    buildLifeboardEventsForDate,
    selectedBucketFilters,
    allTasks
  ]);

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

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="ml-2 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            title="Upload calendar file"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload</span>
          </button>
        </div>
        
        <div className="flex items-center gap-2 sm:space-x-3">
          <h2 className="font-semibold text-base sm:text-lg text-gray-900">
            {getHeaderTitle()}
          </h2>

          {/* Multi-Select Bucket Filter */}
          {(availableBuckets.length > 0 || googleEvents.length > 0 || uploadedEvents.length > 0) && (
            <div className="relative flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Filter:</label>
              <div className="relative bucket-filter-dropdown">
                <button
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 flex items-center gap-1 min-w-[120px] text-left"
                >
                  <span className="truncate flex-1">{getFilterDisplayText()}</span>
                  <svg
                    className={`w-3 h-3 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isFilterDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 min-w-[160px]">
                    <div className="py-1">
                      {/* All Categories Option */}
                      <label className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedBucketFilters.includes('all')}
                          onChange={() => toggleBucketFilter('all')}
                          className="w-3 h-3 text-blue-600 rounded mr-2"
                        />
                        <span className="text-xs">All Categories</span>
                      </label>

                      {/* Bucket Options */}
                      {availableBuckets.map((bucket) => (
                        <label key={bucket} className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedBucketFilters.includes(bucket)}
                            onChange={() => toggleBucketFilter(bucket)}
                            className="w-3 h-3 text-blue-600 rounded mr-2"
                          />
                          <span className="text-xs">{bucket}</span>
                        </label>
                      ))}

                      {/* Unassigned Option */}
                      {availableBuckets.length > 0 && (
                        <label className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedBucketFilters.includes('unassigned')}
                            onChange={() => toggleBucketFilter('unassigned')}
                            className="w-3 h-3 text-blue-600 rounded mr-2"
                          />
                          <span className="text-xs">Unassigned</span>
                        </label>
                      )}

                      {/* Google Calendar Option */}
                      {googleEvents.length > 0 && (
                        <label className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedBucketFilters.includes('google')}
                            onChange={() => toggleBucketFilter('google')}
                            className="w-3 h-3 text-blue-600 rounded mr-2"
                          />
                          <span className="text-xs">Google Calendar</span>
                        </label>
                      )}

                      {/* Uploaded Calendar Option */}
                      {uploadedEvents.length > 0 && (
                        <label className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedBucketFilters.includes('uploaded')}
                            onChange={() => toggleBucketFilter('uploaded')}
                            className="w-3 h-3 text-blue-600 rounded mr-2"
                          />
                          <span className="text-xs">Uploaded Calendar</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {format(currentDate, "EEEE, MMMM d, yyyy")}
                  </h2>
                  <p className="text-sm text-gray-600 mt-2 font-medium">
                    Plan your day with precision scheduling
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => hourlyPlannerRef.current?.openAddTaskModal()}
                  className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  <Plus size={16} />
                  <span>Add task</span>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <HourlyPlanner 
                ref={hourlyPlannerRef}
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
                                const getEventStyle = (source: string, ev?: DayEvent) => {
                                  switch (source) {
                                    case 'google':
                                      return {
                                        container: 'bg-blue-50 border-l-4 border-blue-400 text-blue-900 hover:bg-blue-100',
                                        time: 'text-blue-600',
                                        dot: 'bg-blue-400',
                                        badge: 'text-blue-600'
                                      };
                                    case 'uploaded':
                                      return {
                                        container: 'bg-purple-50 border-l-4 border-purple-400 text-purple-900 hover:bg-purple-100',
                                        time: 'text-purple-600',
                                        dot: 'bg-purple-400',
                                        badge: 'text-purple-600'
                                      };
                                    case 'lifeboard':
                                      return getBucketEventStyles(ev?.bucket, bucketColors);
                                    default:
                                      return {
                                        container: 'bg-gray-50 border-l-4 border-gray-400 text-gray-900 hover:bg-gray-100',
                                        time: 'text-gray-600',
                                        dot: 'bg-gray-400',
                                        badge: 'text-gray-600'
                                      };
                                  }
                                };

                                const styles = getEventStyle(ev.source, ev);
                                const timeDisplay = ev.time ? format(new Date(ev.time), 'h:mm a') : '';
                                const repeatLabel = getRepeatLabel(ev.repeatRule);
                                const hasTask = Boolean(ev.taskId);
                                const canEditEvent = ev.source === 'lifeboard' || ev.source === 'uploaded';
                                const draggableId = hasTask
                                  ? `lifeboard::${ev.taskId}`
                                  : `event::${dayStr}::${i}`;

                                return (
                                  <Draggable
                                    key={draggableId}
                                    draggableId={draggableId}
                                    index={i}
                                    isDragDisabled={!hasTask}
                                  >
                                    {(dragProvided, dragSnapshot) => (
                                      <div
                                        ref={dragProvided.innerRef}
                                          {...dragProvided.draggableProps}
                                        {...(hasTask ? dragProvided.dragHandleProps : {})}
                                        role={canEditEvent ? 'button' : undefined}
                                        tabIndex={canEditEvent ? 0 : undefined}
                                        onClick={async (event) => {
                                          if (!canEditEvent) return;
                                          event.stopPropagation();
                                          const target = event.currentTarget as HTMLElement | null;
                                          if (target && typeof target.blur === 'function') target.blur();
                                          await openCalendarEvent(ev, dayStr);
                                        }}
                                        onKeyDown={async (event) => {
                                          if (!canEditEvent) return;
                                          if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            const target = event.currentTarget as HTMLElement | null;
                                            if (target && typeof target.blur === 'function') target.blur();
                                            await openCalendarEvent(ev, dayStr);
                                          }
                                        }}
                                        className={`group p-2 rounded transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${styles.container} ${dragSnapshot.isDragging ? 'shadow-lg ring-2 ring-emerald-300' : ''}`}
                                        style={{
                                          ...dragProvided.draggableProps.style,
                                          ...(styles.customColor ? {
                                            backgroundColor: styles.customColor + '20',
                                            borderLeftColor: styles.customColor,
                                            borderLeftWidth: '4px'
                                          } : {})
                                        }}
                                        title={`${ev.title}${timeDisplay ? ` at ${timeDisplay}` : ''}${ev.duration ? ` (${ev.duration}min)` : ''}`}
                                        data-task-id={ev.taskId}
                                      >
                                        <div className="flex items-start gap-2">
                                          <div
                                            className={`w-2 h-2 rounded-full ${styles.dot} flex-shrink-0 mt-1`}
                                            style={styles.customColor ? { backgroundColor: styles.customColor } : {}}
                                          />
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
                                          <div className="flex items-center gap-1 flex-shrink-0">
                                            {hasTask && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setDeleteConfirmTask({ id: ev.taskId!, title: ev.title });
                                                }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded hover:bg-red-100 text-red-600 hover:text-red-700"
                                                title="Delete task"
                                              >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                              </button>
                                            )}
                                            <span className={`text-xs ${styles.badge}`}>
                                              {ev.source === 'google' ? 'G' : ev.source === 'lifeboard' ? 'L' : ev.source === 'uploaded' ? 'U' : 'T'}
                                            </span>
                                          </div>
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
                                const getEventStyle = (source: string, ev?: DayEvent) => {
                                  switch (source) {
                                    case 'google':
                                      return {
                                        container: 'bg-blue-50 border-l-4 border-blue-400 text-blue-900 hover:bg-blue-100',
                                        time: 'text-blue-600',
                                        dot: 'bg-blue-400',
                                        badge: 'text-blue-600'
                                      };
                                    case 'uploaded':
                                      return {
                                        container: 'bg-purple-50 border-l-4 border-purple-400 text-purple-900 hover:bg-purple-100',
                                        time: 'text-purple-600',
                                        dot: 'bg-purple-400',
                                        badge: 'text-purple-600'
                                      };
                                    case 'lifeboard':
                                      return getBucketEventStyles(ev?.bucket, bucketColors);
                                    default:
                                      return {
                                        container: 'bg-gray-50 border-l-4 border-gray-400 text-gray-900 hover:bg-gray-100',
                                        time: 'text-gray-600',
                                        dot: 'bg-gray-400',
                                        badge: 'text-gray-600'
                                      };
                                  }
                                };
                                
                                const styles = getEventStyle(ev.source, ev);
                                const timeDisplay = ev.time ? format(new Date(ev.time), 'h:mm a') : '';
                                const repeatLabel = getRepeatLabel(ev.repeatRule);
                                const hasTask = Boolean(ev.taskId);
                                const canEditEvent = ev.source === 'lifeboard' || ev.source === 'uploaded';
                                const draggableId = hasTask
                                  ? `lifeboard::${ev.taskId}`
                                  : `event::${dayStr}::${i}`;

                                return (
                                  <Draggable
                                    key={draggableId}
                                    draggableId={draggableId}
                                    index={i}
                                    isDragDisabled={!hasTask}
                                  >
                                    {(dragProvided, dragSnapshot) => (
                                      <div 
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...(hasTask ? dragProvided.dragHandleProps : {})}
                                        role={canEditEvent ? 'button' : undefined}
                                        tabIndex={canEditEvent ? 0 : undefined}
                                        onClick={async (event) => {
                                          if (!canEditEvent) return;
                                          event.stopPropagation();
                                          const target = event.currentTarget as HTMLElement | null;
                                          if (target && typeof target.blur === 'function') target.blur();
                                          await openCalendarEvent(ev, dayStr);
                                        }}
                                        onKeyDown={async (event) => {
                                          if (!canEditEvent) return;
                                          if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            const target = event.currentTarget as HTMLElement | null;
                                            if (target && typeof target.blur === 'function') target.blur();
                                            await openCalendarEvent(ev, dayStr);
                                          }
                                        }}
                                        className={`group p-1.5 rounded text-xs transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${styles.container} ${dragSnapshot.isDragging ? 'shadow-lg ring-2 ring-emerald-300' : ''}`}
                                        style={{
                                          ...dragProvided.draggableProps.style,
                                          ...(styles.customColor ? {
                                            backgroundColor: styles.customColor + '20',
                                            borderLeftColor: styles.customColor,
                                            borderLeftWidth: '4px'
                                          } : {})
                                        }}
                                        title={`${ev.title}${timeDisplay ? ` at ${timeDisplay}` : ''}${ev.duration ? ` (${ev.duration}min)` : ''}`}
                                      >
                                        <div className="flex items-start gap-1.5">
                                          <div
                                            className={`w-1.5 h-1.5 rounded-full ${styles.dot} flex-shrink-0 mt-0.5`}
                                            style={styles.customColor ? { backgroundColor: styles.customColor } : {}}
                                          />
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
                                          <div className="flex items-center gap-0.5 flex-shrink-0">
                                            {hasTask && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setDeleteConfirmTask({ id: ev.taskId!, title: ev.title });
                                                }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-0.5 rounded hover:bg-red-100 text-red-600 hover:text-red-700"
                                                title="Delete task"
                                              >
                                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                              </button>
                                            )}
                                            <span className={`text-[10px] ${styles.badge}`}>
                                              {ev.source === 'google' ? 'G' : ev.source === 'lifeboard' ? 'L' : ev.source === 'uploaded' ? 'U' : 'T'}
                                            </span>
                                          </div>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedModalDate(null)}
        >
          <div
            className="bg-white rounded-lg w-96 max-w-[90%] p-6"
            onClick={(event) => event.stopPropagation()}
          >
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
                const getDotColor = (source: string, ev?: DayEvent) => {
                  switch (source) {
                    case 'google':
                      return 'bg-blue-500';
                    case 'uploaded':
                      return 'bg-purple-500';
                    case 'lifeboard':
                      const styles = getBucketEventStyles(ev?.bucket, bucketColors);
                      return styles.customColor || styles.dot;
                    default:
                      return 'bg-gray-500';
                  }
                };
                
                const getSourceLabel = (source: string) => {
                  switch (source) {
                    case 'google':
                      return 'Google Calendar';
                    case 'uploaded':
                      return 'Uploaded Calendar';
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
                    <span
                      className={`mt-1 w-2 h-2 rounded-full ${getDotColor(ev.source, ev)}`}
                      style={ev.source === 'lifeboard' && typeof getDotColor(ev.source, ev) === 'string' && getDotColor(ev.source, ev).startsWith('#') ?
                        { backgroundColor: getDotColor(ev.source, ev) } : {}
                      }
                    />
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeTaskModal}
        >
          <div
            className="bg-white rounded-lg w-[520px] max-w-[92%] p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
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
                      <option value="">{UNASSIGNED_BUCKET_LABEL}</option>
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
                          closeTaskModal();
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDeleteConfirmTask(null)}
        >
          <div
            className="bg-white rounded-lg w-96 max-w-[90%] p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Task</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Are you sure you want to delete this task?
                </p>
              </div>
              <button 
                className="text-gray-400 hover:text-gray-600" 
                onClick={() => setDeleteConfirmTask(null)}
              >
                &times;
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-gray-900 truncate">
                {deleteConfirmTask.title}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setDeleteConfirmTask(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                onClick={async () => {
                  try {
                    await deleteTask(deleteConfirmTask.id);
                    setDeleteConfirmTask(null);
                    
                    // Remove from local event state to update UI immediately
                    setEventsByDate(prev => {
                      const updated = { ...prev };
                      Object.keys(updated).forEach(dateKey => {
                        updated[dateKey] = updated[dateKey].filter(ev => ev.taskId !== deleteConfirmTask.id);
                        if (updated[dateKey].length === 0) {
                          delete updated[dateKey];
                        }
                      });
                      return updated;
                    });
                  } catch (error) {
                    console.error('Failed to delete task:', error);
                    // Could add error toast here
                  }
                }}
              >
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Calendar Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-w-4xl w-full mx-4">
            <CalendarFileUpload
              onUploadComplete={async (result) => {
                if (result.success) {
                  try {
                    window.dispatchEvent(new CustomEvent('calendar-upload-complete'));
                    setUploadRefreshIndex((prev) => prev + 1);
                    try {
                      refetch();
                    } catch (refetchError) {
                      console.error('Failed to refresh tasks after calendar upload:', refetchError);
                    }
                  } catch (error) {
                    console.error('Error refreshing calendar data:', error);
                  }
                  setIsUploadModalOpen(false);
                }
              }}
              onClose={() => setIsUploadModalOpen(false)}
            />
          </div>
        </div>
      )}

    </div>
  );
}
