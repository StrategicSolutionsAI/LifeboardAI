"use client";

import { useState, useEffect, useCallback, useRef, useMemo, startTransition } from "react";
import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
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
} from "date-fns";

import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Upload, Clock, CalendarDays, CheckCircle2, GripVertical, MoreHorizontal } from "lucide-react";
import HourlyPlanner, { HourlyPlannerHandle } from "@/features/calendar/components/hourly-planner";
import TaskEditorModal, { TaskEditorModalHandle } from "@/features/tasks/components/task-editor-modal";
import { useTasksContext } from "@/contexts/tasks-context";
import type { RepeatOption, Task } from "@/types/tasks";
import { useDataCache } from "@/hooks/use-data-cache";
import { getBucketColorSync, UNASSIGNED_BUCKET_ID } from "@/lib/bucket-colors";
import { getUserPreferencesClient } from "@/lib/user-preferences";
import { useCalendarStickers, MAX_STICKERS_PER_DAY } from "@/features/calendar/hooks/use-calendar-stickers";
import { sanitizeBucketName, isoToHourLabel } from "@/lib/task-form-utils";
import {
  StickerChips,
  StickerAddButtonCompact,
  StickerPalette,
  StickerRow,
  computeStickerPalettePosition as computeStickerPos,
} from "@/features/calendar/components/calendar-stickers";

type CalendarView = 'month' | 'week' | 'day' | 'agenda';

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

const CalendarFileUpload = dynamic(
  () => import("@/features/calendar/components/calendar-file-upload").then((module) => module.CalendarFileUpload),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-theme-neutral-300 bg-white p-5 text-sm text-theme-text-tertiary shadow-sm">
        Loading calendar uploader...
      </div>
    ),
  }
);

const FETCH_TIMEOUT_MS = 5000;

const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

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
  
  // Map hex colors to Tailwind classes for calendar events (Calidora palette)
  const colorMap: Record<string, any> = {
    "#6B8AF7": { // blue (Calidora)
      container: 'bg-[#f0f3fe] border-l-4 border-[#6B8AF7] text-theme-text-primary hover:bg-[#e3e9fd]',
      time: 'text-[#5570c7]',
      dot: 'bg-[#6B8AF7]',
      badge: 'text-[#5570c7]'
    },
    "#48B882": { // green (Calidora)
      container: 'bg-[#eefaf3] border-l-4 border-[#48B882] text-theme-text-primary hover:bg-[#dcf5e7]',
      time: 'text-[#3a9468]',
      dot: 'bg-theme-success',
      badge: 'text-[#3a9468]'
    },
    "#D07AA4": { // rose (Calidora)
      container: 'bg-[#fdf1f6] border-l-4 border-[#D07AA4] text-theme-text-primary hover:bg-[#fbe3ed]',
      time: 'text-[#b05c86]',
      dot: 'bg-[#D07AA4]',
      badge: 'text-[#b05c86]'
    },
    "#4AADE0": { // sky blue (Calidora)
      container: 'bg-[#eef7fc] border-l-4 border-[#4AADE0] text-theme-text-primary hover:bg-[#dcf0fa]',
      time: 'text-[#3889b5]',
      dot: 'bg-theme-info',
      badge: 'text-[#3889b5]'
    },
    "#C4A44E": { // golden (Calidora)
      container: 'bg-[#faf6ec] border-l-4 border-[#C4A44E] text-theme-text-primary hover:bg-[#f5edd8]',
      time: 'text-[#9e843e]',
      dot: 'bg-theme-warning',
      badge: 'text-[#9e843e]'
    },
    "#8B7FD4": { // plum (Calidora)
      container: 'bg-[#f3f1fb] border-l-4 border-[#8B7FD4] text-theme-text-primary hover:bg-[#e7e3f7]',
      time: 'text-[#6f65aa]',
      dot: 'bg-[#8B7FD4]',
      badge: 'text-[#6f65aa]'
    },
    "#E28A5D": { // orange (Calidora)
      container: 'bg-[#fdf3ee] border-l-4 border-[#E28A5D] text-theme-text-primary hover:bg-[#fbe7dc]',
      time: 'text-[#b56e4a]',
      dot: 'bg-[#E28A5D]',
      badge: 'text-[#b56e4a]'
    },
    "#5E9B8C": { // teal (Calidora)
      container: 'bg-[#eff7f5] border-l-4 border-[#5E9B8C] text-theme-text-primary hover:bg-[#dff0ec]',
      time: 'text-[#4b7c70]',
      dot: 'bg-[#5E9B8C]',
      badge: 'text-[#4b7c70]'
    },
    "#8e99a8": { // gray (unassigned - Calidora)
      container: 'bg-theme-surface-alt border-l-4 border-theme-neutral-400 text-theme-text-primary hover:bg-theme-brand-tint-light',
      time: 'text-theme-text-subtle',
      dot: 'bg-theme-neutral-400',
      badge: 'text-theme-text-subtle'
    },
    // Legacy colors for backwards compatibility
    "#4F46E5": { // indigo (legacy)
      container: 'bg-theme-primary-50 border-l-4 border-theme-secondary text-theme-text-primary hover:bg-theme-surface-selected',
      time: 'text-theme-primary-600',
      dot: 'bg-theme-secondary',
      badge: 'text-theme-primary-600'
    },
    "#94A3B8": { // gray (legacy unassigned)
      container: 'bg-theme-surface-alt border-l-4 border-theme-neutral-400 text-theme-text-primary hover:bg-theme-brand-tint-light',
      time: 'text-theme-text-subtle',
      dot: 'bg-theme-neutral-400',
      badge: 'text-theme-text-subtle'
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

  // For custom colors, return dynamic styles (fallback to brand primary if color is missing)
  const safeColor = color || '#B1916A';
  return {
    container: 'border-l-4 text-theme-text-primary hover:opacity-90',
    time: 'text-theme-text-subtle',
    dot: 'w-2 h-2 rounded-full',
    badge: 'text-theme-text-subtle',
    customColor: safeColor
  };
};

function buildMonthMatrix(currentMonth: Date) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const rows: Date[][] = [];
  let day = startDate;
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
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    week.push(addDays(weekStart, i));
  }
  return [week];
}

function buildDayMatrix(currentDate: Date) {
  return [[currentDate]];
}

interface DayEvent {
  source: 'google' | 'todoist' | 'lifeboard' | 'uploaded' | 'cycle';
  title: string;
  time?: string;
  allDay?: boolean;
  taskId?: string;
  duration?: number;
  repeatRule?: RepeatOption;
  bucket?: string;
  location?: string;
  eventId?: string;
  startDate?: string;
  endDate?: string;
  isRangeStart?: boolean;
  isRangeEnd?: boolean;
}

const toDayKey = (date: Date) => format(date, 'yyyy-MM-dd');

const normalizeEventTitle = (title?: string) => (
  (title ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*([@&:,;\-])\s*/g, '$1')
    .trim()
);

const normalizeEventTimeKey = (event: DayEvent) => {
  if (event.allDay || !event.time) return 'all-day';
  const parsed = new Date(event.time);
  if (Number.isNaN(parsed.getTime())) return (event.time ?? '').toLowerCase();
  return format(parsed, 'HH:mm');
};

const buildCrossSourceEventKey = (event: DayEvent) => {
  return `${normalizeEventTitle(event.title)}::${normalizeEventTimeKey(event)}`;
};

const isTypingInFormField = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

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

/* ─── Mobile Sub-components ─── */

function MobileViewDropdown({ currentView, onViewChange }: { currentView: CalendarView; onViewChange: (v: CalendarView) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const viewOptions: { value: CalendarView; label: string }[] = [
    { value: 'agenda', label: 'Agenda' },
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-md border border-theme-neutral-300 text-[11px] font-medium text-theme-text-secondary"
      >
        {currentView.charAt(0).toUpperCase() + currentView.slice(1)}
        <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-lg border border-theme-neutral-300 bg-white shadow-warm-lg py-1">
          {viewOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onViewChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                currentView === opt.value
                  ? 'bg-theme-brand-tint-light text-theme-primary font-medium'
                  : 'text-theme-text-secondary active:bg-theme-surface-alt'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileOverflowMenu({
  onUpload,
  showFilter,
  isFilterOpen,
  onFilterToggle,
  filterDisplayText,
  selectedBucketFilters,
  toggleBucketFilter,
  filterableBuckets,
  hasGoogleEvents,
  hasUploadedEvents,
}: {
  onUpload: () => void;
  showFilter: boolean;
  isFilterOpen: boolean;
  onFilterToggle: () => void;
  filterDisplayText: string;
  selectedBucketFilters: string[];
  toggleBucketFilter: (bucket: string) => void;
  filterableBuckets: string[];
  hasGoogleEvents: boolean;
  hasUploadedEvents: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="p-1 rounded-md active:bg-theme-brand-tint-light" aria-label="More options">
        <MoreHorizontal className="h-4 w-4 text-theme-text-secondary" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-theme-neutral-300 bg-white shadow-warm-lg py-1">
          <button type="button" onClick={() => { onUpload(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-theme-text-secondary active:bg-theme-surface-alt">
            <Upload className="h-3.5 w-3.5" /> Upload Calendar
          </button>
          {showFilter && (
            <>
              <div className="border-t border-theme-neutral-300/40 my-1" />
              <div className="px-3 py-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-text-quaternary mb-1">Filter</p>
                <label className="flex cursor-pointer items-center py-1"><input type="checkbox" checked={selectedBucketFilters.includes('all')} onChange={() => toggleBucketFilter('all')} className="mr-2 h-3 w-3 rounded accent-theme-primary" /><span className="text-xs text-theme-text-secondary">All Categories</span></label>
                {filterableBuckets.map((bucket) => (<label key={bucket} className="flex cursor-pointer items-center py-1"><input type="checkbox" checked={selectedBucketFilters.includes(bucket)} onChange={() => toggleBucketFilter(bucket)} className="mr-2 h-3 w-3 rounded accent-theme-primary" /><span className="text-xs text-theme-text-secondary">{bucket}</span></label>))}
                {filterableBuckets.length > 0 && (<label className="flex cursor-pointer items-center py-1"><input type="checkbox" checked={selectedBucketFilters.includes('unassigned')} onChange={() => toggleBucketFilter('unassigned')} className="mr-2 h-3 w-3 rounded accent-theme-primary" /><span className="text-xs text-theme-text-secondary">Unassigned</span></label>)}
                {hasGoogleEvents && (<label className="flex cursor-pointer items-center py-1"><input type="checkbox" checked={selectedBucketFilters.includes('google')} onChange={() => toggleBucketFilter('google')} className="mr-2 h-3 w-3 rounded accent-theme-primary" /><span className="text-xs text-theme-text-secondary">Google Calendar</span></label>)}
                {hasUploadedEvents && (<label className="flex cursor-pointer items-center py-1"><input type="checkbox" checked={selectedBucketFilters.includes('uploaded')} onChange={() => toggleBucketFilter('uploaded')} className="mr-2 h-3 w-3 rounded accent-theme-primary" /><span className="text-xs text-theme-text-secondary">Uploaded Calendar</span></label>)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
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
  const { stickersByDate, addStickerToDate, removeStickerFromDate, clearStickersForDate } = useCalendarStickers();
  const [activeStickerDay, setActiveStickerDay] = useState<string | null>(null);
const stickerPaletteRef = useRef<HTMLDivElement | null>(null);
  const stickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [stickerPalettePosition, setStickerPalettePosition] = useState<{ top: number; left: number } | null>(null);

  const computeStickerPalettePosition = useCallback(
    (target: HTMLElement) => computeStickerPos(target),
    [],
  );

  const repositionStickerPalette = useCallback(() => {
    const trigger = stickerTriggerRef.current;
    if (!trigger) return;
    setStickerPalettePosition(computeStickerPalettePosition(trigger));
  }, [computeStickerPalettePosition]);

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

  useEffect(() => {
    if (!activeStickerDay) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (stickerPaletteRef.current?.contains(target)) return;
      if (stickerTriggerRef.current?.contains(target)) return;
      setActiveStickerDay(null);
    };

    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [activeStickerDay]);

  useEffect(() => {
    if (!activeStickerDay) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveStickerDay(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeStickerDay]);

  useEffect(() => {
    if (!activeStickerDay) {
      stickerPaletteRef.current = null;
      stickerTriggerRef.current = null;
      setStickerPalettePosition(null);
    }
  }, [activeStickerDay]);

  useEffect(() => {
    if (!activeStickerDay) return;
    repositionStickerPalette();

    if (typeof window === 'undefined') return;

    const handleWindowChange = () => repositionStickerPalette();
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);
    return () => {
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [activeStickerDay, repositionStickerPalette]);


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
  const handleDateChange = useCallback((newDate: Date) => {
    setCurrentDate(newDate);
    if (typeof window !== 'undefined') {
      localStorage.setItem('calendar-selected-date', format(newDate, 'yyyy-MM-dd'));
    }
    onDateChange?.(newDate);
  }, [onDateChange]);
  // Initialize view from localStorage or default to 'day'
  const [view, setView] = useState<CalendarView>(() => {
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem('calendar-view');
      if (savedView && ['month', 'week', 'day', 'agenda'].includes(savedView)) {
        return savedView as CalendarView;
      }
    }
    return 'day';
  });

  // Track whether the user has manually chosen a view on mobile.
  // Prevents the auto-redirect from overriding an explicit user selection.
  const hasUserChosenMobileView = useRef(false);

  // Persist view changes to localStorage
  const handleViewChange = useCallback((newView: CalendarView) => {
    hasUserChosenMobileView.current = true;
    setView(newView);
    if (typeof window !== 'undefined') {
      localStorage.setItem('calendar-view', newView);
    }
  }, []);

  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [jumpDateValue, setJumpDateValue] = useState(() => format(currentDate, 'yyyy-MM-dd'));
  const jumpDateInputRef = useRef<HTMLInputElement | null>(null);

  const jumpToDate = useCallback(() => {
    if (!jumpDateValue) return;
    const parsed = parseISO(jumpDateValue);
    if (Number.isNaN(parsed.getTime())) return;
    handleDateChange(parsed);
  }, [handleDateChange, jumpDateValue]);

  const [eventsByDate, setEventsByDate] = useState<Record<string, DayEvent[]>>({});
  // Stabilize `today` so it doesn't create a new Date on every render.
  // Updates only when the calendar day actually changes.
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const today = useMemo(() => new Date(), [todayStr]);
  const currentDateKey = useMemo(() => toDayKey(currentDate), [currentDate]);
  const isOnToday = isSameDay(currentDate, today);

  useEffect(() => {
    setJumpDateValue(currentDateKey);
  }, [currentDateKey]);
  const filterableBuckets = useMemo(() => {
    return Array.from(new Set(
      availableBuckets
        .map((bucket) => sanitizeBucketName(bucket))
        .filter((bucket): bucket is string => Boolean(bucket))
    )).sort((a, b) => a.localeCompare(b));
  }, [availableBuckets]);
  const [selectedModalDate, setSelectedModalDate] = useState<string | null>(null);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<{ id: string; title: string; date: string } | null>(null);
  const hourlyPlannerRef = useRef<HourlyPlannerHandle | null>(null);
  const taskEditorRef = useRef<TaskEditorModalHandle | null>(null);
  const [uploadRefreshIndex, setUploadRefreshIndex] = useState(0);

  // Mobile week view: scroll sync refs for 3-day horizontal scroll
  const mobileWeekScrollRef = useRef<HTMLDivElement>(null);
  const mobileWeekBodyRef = useRef<HTMLDivElement>(null);
  const syncMobileWeekScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const src = e.currentTarget;
    const other = src === mobileWeekScrollRef.current
      ? mobileWeekBodyRef.current
      : mobileWeekScrollRef.current;
    if (other && other.scrollLeft !== src.scrollLeft) {
      other.scrollLeft = src.scrollLeft;
    }
  }, []);

  useEffect(() => {
    setActiveStickerDay(null);
  }, [view, currentDateKey]);

  // Get tasks from context
  const { allTasks, deleteTask, refetch, getTaskForOccurrence, createTask } = useTasksContext();

  // O(1) task lookup by ID instead of O(n) linear scan
  const taskLookup = useMemo(
    () => new Map(allTasks.map(t => [t.id?.toString(), t])),
    [allTasks]
  );
  const resolveTaskById = useCallback((taskId?: string | null) => {
    if (!taskId) return undefined;
    return taskLookup.get(taskId.toString());
  }, [taskLookup]);

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

  const normalizeDateString = useCallback((value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.length > 10 ? trimmed.slice(0, 10) : trimmed;
  }, []);

  // Single-pass: iterate tasks once and compute which visible dates each belongs to.
  // Returns a map of dateStr → DayEvent[]. O(tasks * avgSpan) instead of O(tasks * visibleDates).
  const buildAllLifeboardEvents = useCallback((rangeStart: Date, rangeEnd: Date): Record<string, DayEvent[]> => {
    const result: Record<string, DayEvent[]> = {};
    const rangeStartMs = rangeStart.getTime();
    const rangeEndMs = rangeEnd.getTime();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const filterAll = selectedBucketFilters.includes('all');

    const addEvent = (dateStr: string, event: DayEvent) => {
      const bucket = result[dateStr] ?? (result[dateStr] = []);
      bucket.push(event);
    };

    const buildEventForDate = (task: Task, dateStr: string, taskStartStr: string, taskEndStr: string) => {
      const adjustedTask = getTaskForOccurrence(task, dateStr);
      if (!adjustedTask) return;

      if (!filterAll) {
        const taskBucket = adjustedTask.bucket || 'unassigned';
        if (!selectedBucketFilters.includes(taskBucket)) return;
      }

      const repeatRule = adjustedTask.repeatRule ? (adjustedTask.repeatRule as RepeatOption) : undefined;
      const adjStart = adjustedTask.startDate ?? adjustedTask.due?.date;
      const adjEnd = adjustedTask.endDate ?? adjStart;
      const isRangeStart = dateStr === (adjStart ?? taskStartStr);
      const isRangeEnd = dateStr === (adjEnd ?? taskEndStr);
      const eventAllDay = adjustedTask.allDay === true;

      const baseEvent: DayEvent = {
        source: 'lifeboard',
        title: adjustedTask.content,
        allDay: eventAllDay,
        taskId: adjustedTask.id,
        repeatRule,
        bucket: adjustedTask.bucket,
        startDate: adjStart ?? undefined,
        endDate: adjEnd ?? undefined,
        isRangeStart,
        isRangeEnd,
      };

      if (!eventAllDay && adjustedTask.hourSlot && isRangeStart) {
        baseEvent.time = hourSlotToISO(adjustedTask.hourSlot, dateStr);
        baseEvent.duration = adjustedTask.duration || 60;
      } else if (!eventAllDay && !isRangeStart) {
        baseEvent.time = undefined;
        baseEvent.duration = undefined;
      } else if (adjustedTask.duration) {
        baseEvent.duration = adjustedTask.duration;
      }

      addEvent(dateStr, baseEvent);
    };

    allTasks.forEach((task: Task) => {
      if (!task || task.completed) return;
      const startRaw = normalizeDateString(task.startDate ?? task.due?.date);
      if (!startRaw) return;
      const endRaw = normalizeDateString(task.endDate) ?? startRaw;

      const rule = task.repeatRule as string | undefined;
      if (!rule || rule === 'none') {
        // Non-repeating: clamp [startRaw, endRaw] to visible range and iterate
        const clampedStart = startRaw < format(rangeStart, 'yyyy-MM-dd') ? format(rangeStart, 'yyyy-MM-dd') : startRaw;
        const clampedEnd = endRaw > format(rangeEnd, 'yyyy-MM-dd') ? format(rangeEnd, 'yyyy-MM-dd') : endRaw;
        if (clampedStart > clampedEnd) return;

        let cursor = new Date(`${clampedStart}T00:00:00`);
        const end = new Date(`${clampedEnd}T00:00:00`);
        while (cursor <= end) {
          const dateStr = format(cursor, 'yyyy-MM-dd');
          buildEventForDate(task, dateStr, startRaw, endRaw);
          cursor = addDays(cursor, 1);
        }
        return;
      }

      // Repeating tasks: generate occurrences within visible range
      const due = new Date(`${startRaw}T00:00:00`);
      const dueMs = due.getTime();
      if (dueMs > rangeEndMs) return; // starts after visible range

      switch (task.repeatRule) {
        case 'daily': {
          // Every day from max(due, rangeStart) to rangeEnd
          let cursor = dueMs >= rangeStartMs ? due : rangeStart;
          while (cursor.getTime() <= rangeEndMs) {
            buildEventForDate(task, format(cursor, 'yyyy-MM-dd'), startRaw, endRaw);
            cursor = addDays(cursor, 1);
          }
          break;
        }
        case 'weekdays': {
          let cursor = dueMs >= rangeStartMs ? due : rangeStart;
          while (cursor.getTime() <= rangeEndMs) {
            const day = cursor.getDay();
            if (day >= 1 && day <= 5) {
              buildEventForDate(task, format(cursor, 'yyyy-MM-dd'), startRaw, endRaw);
            }
            cursor = addDays(cursor, 1);
          }
          break;
        }
        case 'weekly': {
          const dueDay = due.getDay();
          // Find the first matching day >= rangeStart
          let cursor = dueMs >= rangeStartMs ? due : new Date(rangeStartMs);
          // Align to the correct weekday
          const cursorDay = cursor.getDay();
          let daysUntilMatch = (dueDay - cursorDay + 7) % 7;
          // Also ensure the diff from due is a multiple of 7
          if (daysUntilMatch === 0) {
            const diffFromDue = Math.floor((cursor.getTime() - dueMs) / MS_PER_DAY);
            if (diffFromDue % 7 !== 0) daysUntilMatch = 7;
          }
          cursor = addDays(cursor, daysUntilMatch);
          while (cursor.getTime() <= rangeEndMs) {
            buildEventForDate(task, format(cursor, 'yyyy-MM-dd'), startRaw, endRaw);
            cursor = addDays(cursor, 7);
          }
          break;
        }
        case 'monthly': {
          const dueDateNum = due.getDate();
          // Iterate each month in the visible range
          let month = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
          const rangeEndMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth() + 1, 0);
          while (month <= rangeEndMonth) {
            const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
            const targetDateNum = dueDateNum > daysInMonth ? daysInMonth : dueDateNum;
            const candidate = new Date(month.getFullYear(), month.getMonth(), targetDateNum);
            if (candidate.getTime() >= dueMs && candidate.getTime() >= rangeStartMs && candidate.getTime() <= rangeEndMs) {
              buildEventForDate(task, format(candidate, 'yyyy-MM-dd'), startRaw, endRaw);
            }
            month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
          }
          break;
        }
        default:
          break;
      }
    });

    return result;
  }, [allTasks, getTaskForOccurrence, hourSlotToISO, normalizeDateString, selectedBucketFilters]);

  const openTaskEditor = useCallback((event: DayEvent, dateStr: string) => {
    if (!event.taskId) return;
    const task = resolveTaskById(event.taskId);
    const targetDate = dateStr || task?.due?.date || format(currentDate, 'yyyy-MM-dd');
    const fallbackHour = isoToHourLabel(event.time);
    setSelectedModalDate(null);
    taskEditorRef.current?.openWithTask(task, targetDate, {
      fallbackTitle: event.title,
      fallbackHourLabel: fallbackHour,
      fallbackTaskId: event.taskId,
      fallbackRepeat: event.repeatRule ?? null,
      fallbackBucket: event.bucket,
      fallbackEndDate: event.endDate ?? event.startDate ?? targetDate,
      fallbackEndHourLabel: event.isRangeEnd ? fallbackHour : undefined,
      fallbackAllDay: event.allDay,
    });
  }, [currentDate, resolveTaskById]);

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
    setSelectedModalDate(null);
    taskEditorRef.current?.openByTaskId(taskId, metadata);
  }, []);

  const taskEditorDefaultDate = useCallback(() => format(currentDate, 'yyyy-MM-dd'), [currentDate]);

  const openCalendarEvent = useCallback(async (calendarEvent: DayEvent, dateStr: string) => {
    // If it's a Google Calendar event, convert it to a task first
    if (calendarEvent.source === 'google') {
      try {
        // Create a new task from the Google Calendar event
        const hourSlot = calendarEvent.time ? isoToHourLabel(calendarEvent.time) : null;
        // Convert hour slot to hour number (e.g., "9AM" -> 9, "2PM" -> 14)
        const hourNumber = hourSlot ? (() => {
          const match = hourSlot.match(/(\d{1,2})(AM|PM)/i);
          if (!match) return null;
          let hours = parseInt(match[1], 10);
          const period = match[2].toUpperCase();
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          return hours;
        })() : null;
        
        const task = await createTask(
          calendarEvent.title,
          dateStr,
          hourNumber,
          calendarEvent.bucket || undefined,
          undefined,
          {
            allDay: calendarEvent.allDay ?? !calendarEvent.time,
            endDate: dateStr,
          }
        );
        
        if (task?.id) {
          // Refresh tasks to get the new task
          await refetch();
          // Open the newly created task in the editor
          taskEditorRef.current?.openByTaskId(task.id.toString(), {
            plannerDate: dateStr,
            hourSlot: hourSlot || undefined,
          });
        } else {
          console.error('❌ Task creation returned no ID');
        }
        return;
      } catch (error) {
        console.error('Failed to convert Google Calendar event to task:', error);
        if (typeof window !== 'undefined') {
          window.alert('Failed to convert this Google Calendar event into an editable task. Please try again.');
        }
        return;
      }
    }
    
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
  }, [ensureTaskForEvent, setEventsByDate, setUploadRefreshIndex, refetch, openTaskEditor, createTask]);

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

  // Listen for task clicks from the sidebar to open the edit modal
  useEffect(() => {
    const handler = (event: CustomEvent) => {
      const { taskId, dateStr } = event.detail;
      // Open the task editor with the date context
      void openTaskEditorById(taskId, { plannerDate: dateStr });
    };

    window.addEventListener('lifeboard:task-click', handler as EventListener);
    return () => window.removeEventListener('lifeboard:task-click', handler as EventListener);
  }, [openTaskEditorById]);

  const nextPeriod = useCallback(() => {
    const newDate = (() => {
      switch (view) {
        case 'month':
          return addMonths(currentDate, 1);
        case 'week':
          return addWeeks(currentDate, 1);
        case 'day':
          return addDays(currentDate, 1);
        case 'agenda':
          return addDays(currentDate, 7);
        default:
          return currentDate;
      }
    })();
    handleDateChange(newDate);
  }, [currentDate, handleDateChange, view]);

  const prevPeriod = useCallback(() => {
    const newDate = (() => {
      switch (view) {
        case 'month':
          return subMonths(currentDate, 1);
        case 'week':
          return addWeeks(currentDate, -1);
        case 'day':
          return addDays(currentDate, -1);
        case 'agenda':
          return addDays(currentDate, -7);
        default:
          return currentDate;
      }
    })();
    handleDateChange(newDate);
  }, [currentDate, handleDateChange, view]);

  useEffect(() => {
    const handleCalendarShortcuts = (event: KeyboardEvent) => {
      if (isTypingInFormField(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape') {
        if (activeStickerDay) {
          setActiveStickerDay(null);
          return;
        }
        if (isFilterDropdownOpen) {
          setIsFilterDropdownOpen(false);
          return;
        }
        if (selectedModalDate) {
          setSelectedModalDate(null);
          return;
        }
        if (deleteConfirmTask) {
          setDeleteConfirmTask(null);
          return;
        }
        if (isUploadModalOpen) {
          setIsUploadModalOpen(false);
          return;
        }
        if (showKeyboardHelp) {
          setShowKeyboardHelp(false);
          return;
        }
      }

      const lower = event.key.toLowerCase();

      if (lower === 'arrowleft') {
        event.preventDefault();
        prevPeriod();
        return;
      }

      if (lower === 'arrowright') {
        event.preventDefault();
        nextPeriod();
        return;
      }

      if (lower === 't') {
        event.preventDefault();
        handleDateChange(new Date());
        return;
      }

      if (lower === 'g') {
        event.preventDefault();
        jumpDateInputRef.current?.focus();
        jumpDateInputRef.current?.showPicker?.();
        return;
      }

      if (lower === '1') {
        event.preventDefault();
        handleViewChange('day');
        return;
      }

      if (lower === '2') {
        event.preventDefault();
        handleViewChange('week');
        return;
      }

      if (lower === '3') {
        event.preventDefault();
        handleViewChange('month');
        return;
      }

      if (lower === '4') {
        event.preventDefault();
        handleViewChange('agenda');
        return;
      }

      if (lower === '?') {
        event.preventDefault();
        setShowKeyboardHelp((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleCalendarShortcuts);
    return () => window.removeEventListener('keydown', handleCalendarShortcuts);
  }, [
    activeStickerDay,
    deleteConfirmTask,
    handleDateChange,
    handleViewChange,
    isFilterDropdownOpen,
    isUploadModalOpen,
    nextPeriod,
    prevPeriod,
    selectedModalDate,
    showKeyboardHelp,
  ]);

  const getDateRange = useCallback(() => {
    switch (view) {
      case 'month':
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate)
        };
      case 'week':
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(currentDate, { weekStartsOn: 1 })
        };
      case 'day':
        return {
          start: startOfDay(currentDate),
          end: endOfDay(currentDate)
        };
      case 'agenda':
        return {
          start: startOfDay(currentDate),
          end: endOfDay(addDays(currentDate, 13))
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
        maxResults: '500',
      });
      const resp = await fetchWithTimeout(`/api/integrations/google/calendar/events?${params.toString()}`);
      if (!resp.ok) {
        if (resp.status === 401) {
          return [];
        }
        throw new Error(`Failed to fetch Google events: ${resp.status}`);
      }
      const payload = await resp.json();
      return Array.isArray(payload.events) ? payload.events : [];
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return [];
      }
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
      const resp = await fetchWithTimeout('/api/calendar/upload', { cache: 'no-store' });
      if (!resp.ok) {
        if (resp.status === 401) {
          return [];
        }
        throw new Error(`Failed to fetch uploaded events: ${resp.status}`);
      }
      const payload = await resp.json();
      return Array.isArray(payload.events) ? payload.events : [];
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return [];
      }
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

  // Fetch cycle tracking entries for calendar display
  const cycleCacheKey = `cycle-tracking-calendar`;
  const cycleEntriesFetcher = useCallback(async () => {
    try {
      const resp = await fetchWithTimeout('/api/widgets/cycle-tracking?limit=90', { cache: 'no-store' });
      if (!resp.ok) return [];
      const data = await resp.json();
      return Array.isArray(data?.entries) ? data.entries : [];
    } catch {
      return [];
    }
  }, []);

  const {
    data: cycleEntriesRaw,
  } = useDataCache<any[] | null>(cycleCacheKey, cycleEntriesFetcher, {
    ttl: 5 * 60 * 1000,
    prefetch: false,
  });

  const cycleEntries = useMemo(() => (Array.isArray(cycleEntriesRaw) ? cycleEntriesRaw : []), [cycleEntriesRaw]);

  const rows = useMemo(() => {
    switch (view) {
      case 'month':
        return buildMonthMatrix(currentDate);
      case 'week':
        return buildWeekMatrix(currentDate);
      case 'day':
        return buildDayMatrix(currentDate);
      case 'agenda':
        return []; // Agenda uses agendaDays memo instead
      default:
        return buildMonthMatrix(currentDate);
    }
  }, [currentDate, view]);

  const headerTitle = useMemo(() => {
    switch (view) {
      case 'month':
        return format(currentDate, "MMMM yyyy");
      case 'week': {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
      }
      case 'day':
        return format(currentDate, "EEEE, MMMM d, yyyy");
      case 'agenda':
        return format(currentDate, "MMMM yyyy");
      default:
        return format(currentDate, "MMMM yyyy");
    }
  }, [currentDate, view]);

  const selectedDateEvents = useMemo(() => (eventsByDate[currentDateKey] ?? []), [currentDateKey, eventsByDate]);

  const eventsInViewCount = useMemo(() => {
    const keys = new Set(rows.flat().map((date) => toDayKey(date)));
    let total = 0;
    keys.forEach((key) => {
      total += eventsByDate[key]?.length ?? 0;
    });
    return total;
  }, [eventsByDate, rows]);

  const importedDayEvents = useMemo(() => {
    return selectedDateEvents.filter((event) => event.source === 'uploaded');
  }, [selectedDateEvents]);

  const importedTimedEvents = useMemo(() => {
    return importedDayEvents
      .filter((event) => Boolean(event.time) && !event.allDay)
      .map((event) => ({
        ...event,
        parsedTime: (() => {
          if (!event.time) return null;
          try {
            return new Date(event.time);
          } catch {
            return null;
          }
        })(),
      }))
      .sort((a, b) => {
        const timeA = a.parsedTime?.getTime() ?? 0;
        const timeB = b.parsedTime?.getTime() ?? 0;
        return timeA - timeB;
      });
  }, [importedDayEvents]);

  const importedAllDayEvents = useMemo(() => (
    importedDayEvents.filter((event) => event.allDay || !event.time)
  ), [importedDayEvents]);

  // Day view summary stats
  const dayViewStats = useMemo(() => {
    const events = selectedDateEvents;
    const taskCount = events.filter(e => e.source === 'lifeboard').length;
    const totalMinutes = events.reduce((sum, e) => sum + (e.duration ?? 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const plannedLabel = hours > 0 && mins > 0
      ? `${hours}h ${mins}m`
      : hours > 0
      ? `${hours}h`
      : mins > 0
      ? `${mins}m`
      : null;
    const allDayEvents = events.filter(e => e.allDay && e.source === 'lifeboard');
    const googleCount = events.filter(e => e.source === 'google').length;
    return { taskCount, plannedLabel, allDayEvents, googleCount };
  }, [selectedDateEvents]);

  // Sync propSelectedDate prop with currentDate state
  useEffect(() => {
    if (propSelectedDate && propSelectedDate.getTime() !== currentDate.getTime()) {
      setCurrentDate(propSelectedDate);
    }
  }, [propSelectedDate, currentDate]);

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

  // Task updates are handled by TasksContext — allTasks updates automatically
  // via optimistic updates and the useTasks hook's own event listener with
  // proper version tracking. A manual refetch here would wipe optimistic state.

  // Legacy bucket label retained for older imports
  const IMPORTED_CALENDAR_BUCKET_NAME = 'Imported Calendar';

  // Build events map whenever data sources change
  useEffect(() => {
    const map: Record<string, DayEvent[]> = {};
    const seenTaskInstanceKeys = new Set<string>();

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

      const startDateStr = ev.start_date || (ev.start_time ? ev.start_time.slice(0, 10) : undefined);
      if (!startDateStr) return;
      const endDateStr = ev.end_date || startDateStr;

      const rangeStart = startOfDay(new Date(rangeStartMs));
      const rangeEnd = startOfDay(new Date(rangeEndMs));
      const startDateObj = startOfDay(new Date(`${startDateStr}T00:00:00`));
      const endDateObj = startOfDay(new Date(`${endDateStr}T00:00:00`));

      if (endDateObj < rangeStart || startDateObj > rangeEnd) {
        return;
      }

      let resolvedTaskId: string | undefined = ev.task_id ?? undefined;
      let matchedTask: any | undefined;

      if (resolvedTaskId) {
        matchedTask = resolveTaskById(resolvedTaskId);
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
          if ((task.due?.date ?? '') !== startDateStr) return false;
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
      const eventAllDay = ev.all_day || (!ev.start_time && !ev.hour_slot && !ev.end_hour_slot);

      let cursor = startDateObj;
      while (cursor.getTime() <= endDateObj.getTime()) {
        if (cursor.getTime() >= rangeStart.getTime() && cursor.getTime() <= rangeEnd.getTime()) {
          const dayKey = format(cursor, 'yyyy-MM-dd');
          const bucket = map[dayKey] ?? (map[dayKey] = []);
          const taskIdKey = resolvedTaskId ? resolvedTaskId.toString() : undefined;
          const seenKey = taskIdKey ? `${taskIdKey}-${dayKey}` : undefined;
          if (seenKey && seenTaskInstanceKeys.has(seenKey)) {
            cursor = addDays(cursor, 1);
            continue;
          }

          const isRangeStart = dayKey === startDateStr;
          const isRangeEnd = dayKey === endDateStr;
          // Prefer the task's hour slot when available so week/month times match the editable task view
          const resolvedHourSlot = typeof matchedTask?.hourSlot === 'string'
            ? matchedTask.hourSlot
            : typeof ev.hour_slot === 'string'
              ? ev.hour_slot
              : undefined;

          let eventTime: string | undefined;
          if (!eventAllDay && isRangeStart) {
            if (resolvedHourSlot) {
              eventTime = hourSlotToISO(resolvedHourSlot, startDateStr);
            }
            if (!eventTime && ev.start_time) {
              eventTime = ev.start_time ?? undefined;
            }
          }

          bucket.push({
            source: resolvedTaskId ? 'lifeboard' : 'uploaded',
            title: ev.title ?? 'Uploaded Event',
            time: eventTime,
            allDay: eventAllDay || (!isRangeStart && !isRangeEnd),
            location: ev.location ?? undefined,
            taskId: resolvedTaskId,
            bucket: resolvedBucket,
            repeatRule: resolvedRepeatRule,
            eventId: ev.id,
            startDate: startDateStr,
            endDate: endDateStr,
            isRangeStart,
            isRangeEnd,
          });

          if (seenKey) {
            seenTaskInstanceKeys.add(seenKey);
          }
        }
        cursor = addDays(cursor, 1);
      }
    });

    // Add cycle tracking entries as all-day events
    cycleEntries.forEach((entry: any) => {
      const dateStr = typeof entry.date === 'string' ? entry.date.slice(0, 10) : undefined;
      if (!dateStr) return;
      const flow = entry.flow_intensity || 'none';
      if (flow === 'none') return; // Only show flow days on calendar
      const flowLabel = flow.charAt(0).toUpperCase() + flow.slice(1);
      const symptoms: string[] = Array.isArray(entry.symptoms) ? entry.symptoms : [];
      const title = entry.period_start
        ? `Period Start \u2014 ${flowLabel} flow`
        : `${flowLabel} flow${symptoms.length ? ' \u00B7 ' + symptoms.slice(0, 2).join(', ') : ''}`;
      const bucket = map[dateStr] ?? (map[dateStr] = []);
      bucket.push({
        source: 'cycle',
        title,
        allDay: true,
      });
    });

    // Single-pass: build all lifeboard events at once instead of per-date
    const lifeboardMap = buildAllLifeboardEvents(
      startOfDay(new Date(rangeStartMs)),
      startOfDay(new Date(rangeEndMs))
    );
    for (const dateStr of Object.keys(lifeboardMap)) {
      const bucket = map[dateStr] ?? (map[dateStr] = []);
      for (const event of lifeboardMap[dateStr]) {
        const taskIdKey = event.taskId ? event.taskId.toString() : undefined;
        const seenKey = taskIdKey ? `${taskIdKey}-${dateStr}` : undefined;
        if (seenKey && seenTaskInstanceKeys.has(seenKey)) {
          continue;
        }
        bucket.push(event);
        if (seenKey) {
          seenTaskInstanceKeys.add(seenKey);
        }
      }
    }

    // Prefer task-backed Lifeboard entries over imported/Google items only when they represent
    // the same event signature (title + time/all-day). This avoids dropping distinct events that
    // happen to share a title on the same day.
    Object.keys(map).forEach(dateStr => {
      const events = map[dateStr];
      const lifeboardKeys = new Set(
        events
          .filter((event) => event.source === 'lifeboard')
          .map((event) => buildCrossSourceEventKey(event))
      );

      if (lifeboardKeys.size === 0) return;

      map[dateStr] = events.filter((event) => {
        if (event.source === 'lifeboard' || event.taskId) return true;
        return !lifeboardKeys.has(buildCrossSourceEventKey(event));
      });
    });

    // Defer the state update so the expensive event map rebuild doesn't block
    // user interactions (typing, scrolling) while allTasks background-refreshes.
    startTransition(() => {
      setEventsByDate(map);
    });
  }, [
    googleEvents,
    uploadedEvents,
    cycleEntries,
    rangeStartMs,
    rangeEndMs,
    buildAllLifeboardEvents,
    selectedBucketFilters,
    allTasks,
    hourSlotToISO
  ]);

  const getCellSize = () => {
    switch (view) {
      case 'month':
        return 'min-h-[115px] sm:min-h-[135px]';
      case 'week':
        return 'min-h-[200px] sm:min-h-[360px]';
      case 'day':
        return 'min-h-[600px]';
      default:
        return 'min-h-[115px] sm:min-h-[135px]';
    }
  };

  const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [isCompactBreakpoint, setIsCompactBreakpoint] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsCompactBreakpoint(event.matches);
    };

    update(mq);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  // Auto-switch to agenda on first mobile entry only.
  // If the user manually picks a view, don't override it.
  useEffect(() => {
    if (isCompactBreakpoint && !hasUserChosenMobileView.current && view !== 'agenda') {
      handleViewChange('agenda');
      // Reset so the auto-switch doesn't count as a "user choice"
      hasUserChosenMobileView.current = false;
    }
    if (!isCompactBreakpoint) {
      hasUserChosenMobileView.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompactBreakpoint]);

  // Auto-scroll mobile week view to today's column on mount
  useEffect(() => {
    if (!isCompactBreakpoint || view !== 'week' || !mobileWeekBodyRef.current) return;
    const weekDays = rows.flat();
    const todayIdx = weekDays.findIndex(d => isSameDay(d, today));
    if (todayIdx < 0) return;
    const colWidth = mobileWeekBodyRef.current.scrollWidth / 7;
    mobileWeekBodyRef.current.scrollLeft = todayIdx * colWidth;
    if (mobileWeekScrollRef.current) {
      mobileWeekScrollRef.current.scrollLeft = todayIdx * colWidth;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompactBreakpoint, view]);

  // Calculate dynamic max visible events based on event complexity
  const getMaxVisibleEvents = useCallback((dayEvents: DayEvent[]) => {
    // Base limits for complex events
    const baseLimit = isCompactBreakpoint ? 3 : 4;

    // For week view or if no events, use base limit
    if (view === 'week' || dayEvents.length === 0) {
      return baseLimit;
    }

    // Calculate how "heavy" the events are (how much space they take)
    // Events with time and/or duration take more space
    const hasTimeInfo = dayEvents.some(ev => ev.time || ev.duration);
    const avgComplexity = dayEvents.slice(0, 10).reduce((sum, ev) => {
      let complexity = 1; // Base line for title
      if (ev.time) complexity += 0.3; // Time takes space
      if (ev.duration) complexity += 0.2; // Duration takes space
      if (ev.repeatRule) complexity += 0.1; // Repeat icon takes small space
      return sum + complexity;
    }, 0) / Math.min(dayEvents.length, 10);

    // Adjust limits based on event complexity to maximize space usage
    if (avgComplexity <= 1.15 && !hasTimeInfo) {
      // Events are very simple (just titles) - can show many more
      // Month view day cells can typically fit 10-12 minimal events
      return isCompactBreakpoint ? 8 : 12;
    } else if (avgComplexity <= 1.25) {
      // Events have minimal detail - can show several more
      return isCompactBreakpoint ? 6 : 9;
    } else if (avgComplexity <= 1.4) {
      // Events have moderate detail - can show a few more
      return isCompactBreakpoint ? 5 : 6;
    }

    // Events are complex with full details, use base limit
    return baseLimit;
  }, [view, isCompactBreakpoint]);

  const sortEventsForDisplay = useCallback((dayEvents: DayEvent[]) => {
    return [...dayEvents].sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;

      if (a.time && b.time) {
        const timeA = new Date(a.time).getTime();
        const timeB = new Date(b.time).getTime();
        if (timeA !== timeB) return timeA - timeB;
      }

      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;

      return (a.title ?? '').localeCompare(b.title ?? '');
    });
  }, []);

  // Compute agenda view data (14 days of events)
  const agendaDays = useMemo(() => {
    if (view !== 'agenda') return [];
    const days: { date: Date; dateStr: string; events: DayEvent[]; isToday: boolean }[] = [];
    for (let i = 0; i < 14; i++) {
      const date = addDays(currentDate, i);
      const dateStr = toDayKey(date);
      const events = sortEventsForDisplay(eventsByDate[dateStr] ?? []);
      days.push({ date, dateStr, events, isToday: isSameDay(date, today) });
    }
    return days;
  }, [view, currentDate, eventsByDate, sortEventsForDisplay, today]);

  const getEventsForDisplay = useCallback((dayEvents: DayEvent[]) => {
    const sortedEvents = sortEventsForDisplay(dayEvents);
    if (view === 'week') {
      return sortedEvents;
    }

    const maxVisibleEvents = getMaxVisibleEvents(sortedEvents);
    return sortedEvents.slice(0, maxVisibleEvents);
  }, [getMaxVisibleEvents, sortEventsForDisplay, view]);
  const multiDayMinWidth = isCompactBreakpoint
    ? 'w-full'
    : view === 'week'
      ? 'w-full'
      : 'min-w-[600px]';

  const weekdayHeader = (
    <div className="grid grid-cols-7 border-b border-theme-neutral-300/60">
      {weekDayLabels.map((label, i) => (
        <div
          key={label}
          className={`py-2 text-center text-[10px] font-medium tracking-[0.8px] uppercase text-theme-text-tertiary ${
            i < 6 ? 'border-r border-theme-neutral-300/40' : ''
          }`}
        >
          {label}
        </div>
      ))}
    </div>
  );

  const resolveEventStyles = useCallback(
    (source: DayEvent['source'], ev?: DayEvent) => {
      switch (source) {
        case 'google':
          return {
            container: 'border border-theme-neutral-300 bg-theme-primary-50/90 text-theme-text-primary shadow-sm hover:bg-theme-primary-50',
            time: 'text-theme-secondary',
            dot: 'bg-theme-secondary',
            badge: 'text-theme-secondary'
          };
        case 'uploaded':
          return {
            container: 'border border-purple-100 bg-purple-50/90 text-purple-900 shadow-sm hover:bg-purple-50',
            time: 'text-purple-500',
            dot: 'bg-purple-400',
            badge: 'text-purple-500'
          };
        case 'cycle':
          return {
            container: 'border border-pink-200 bg-pink-50/90 text-pink-900 shadow-sm hover:bg-pink-100',
            time: 'text-pink-500',
            dot: 'bg-pink-400',
            badge: 'text-pink-600'
          };
        case 'lifeboard':
          return getBucketEventStyles(ev?.bucket, bucketColors);
        default:
          return {
            container: 'border border-theme-neutral-300 bg-theme-surface-alt/90 text-theme-text-primary shadow-sm hover:bg-theme-surface-alt',
            time: 'text-theme-text-tertiary',
            dot: 'bg-theme-neutral-400',
            badge: 'text-theme-text-tertiary'
          };
      }
    },
    [bucketColors]
  );

  const showFilterControls = filterableBuckets.length > 0 || googleEvents.length > 0 || uploadedEvents.length > 0;

  return (
    <div className="w-full max-w-none bg-white border border-theme-neutral-300/80 rounded-xl shadow-warm-sm overflow-hidden h-full flex flex-col">
      {/* Calendar Header */}
      {isCompactBreakpoint ? (
        /* ─── MOBILE HEADER ─── */
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-theme-neutral-300/60">
          <h3 className="text-base font-semibold text-theme-text-primary truncate">
            {format(currentDate, "MMMM yyyy")}
          </h3>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => handleDateChange(new Date())} disabled={isOnToday}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${isOnToday ? 'bg-theme-surface-alt text-theme-text-quaternary' : 'bg-theme-primary text-white active:bg-[#a8896a]'}`}>Today</button>
            <MobileViewDropdown currentView={view} onViewChange={handleViewChange} />
            <button type="button" onClick={prevPeriod} className="p-1 rounded-md active:bg-theme-brand-tint-light" aria-label="Previous">
              <svg className="h-4 w-4 text-theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button type="button" onClick={nextPeriod} className="p-1 rounded-md active:bg-theme-brand-tint-light" aria-label="Next">
              <svg className="h-4 w-4 text-theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <MobileOverflowMenu onUpload={() => setIsUploadModalOpen(true)} showFilter={showFilterControls} isFilterOpen={isFilterDropdownOpen} onFilterToggle={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)} filterDisplayText={getFilterDisplayText()} selectedBucketFilters={selectedBucketFilters} toggleBucketFilter={toggleBucketFilter} filterableBuckets={filterableBuckets} hasGoogleEvents={googleEvents.length > 0} hasUploadedEvents={uploadedEvents.length > 0} />
          </div>
        </div>
      ) : (
        /* ─── DESKTOP HEADER ─── */
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-theme-neutral-300/60">
          <h3 className="section-label-sm">{headerTitle}</h3>
          <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-theme-neutral-300 overflow-hidden">
            {(['month', 'week', 'day'] as CalendarView[]).map((viewOption) => (
              <button
                type="button"
                key={viewOption}
                onClick={() => handleViewChange(viewOption)}
                aria-pressed={view === viewOption}
                className={`px-3 py-1.5  text-[11px] tracking-[0.6px] uppercase transition-colors ${
                  view === viewOption
                    ? 'bg-theme-primary text-white'
                    : 'text-theme-text-secondary hover:bg-[rgba(252,250,248,0.5)]'
                }`}
              >
                {viewOption}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleDateChange(new Date())}
            disabled={isOnToday}
            className={`px-3 py-1.5 rounded-lg border border-theme-neutral-300 text-xs transition-colors ${
              isOnToday
                ? 'cursor-default text-[#c5c9d0]'
                : 'text-theme-text-secondary hover:bg-[rgba(252,250,248,0.5)]'
            }`}
            title="Jump to today (T)"
          >
            Today
          </button>

          <button
            type="button"
            onClick={prevPeriod}
            className="p-1.5 rounded-lg hover:bg-[rgba(252,250,248,0.5)] transition-colors"
            aria-label="Previous period"
          >
            <svg className="h-[18px] w-[18px] text-theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={nextPeriod}
            className="p-1.5 rounded-lg hover:bg-[rgba(252,250,248,0.5)] transition-colors"
            aria-label="Next period"
          >
            <svg className="h-[18px] w-[18px] text-theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="p-1.5 rounded-lg border border-theme-neutral-300 text-theme-text-secondary hover:bg-[rgba(252,250,248,0.5)] transition-colors"
            title="Upload calendar file"
            aria-label="Upload calendar file"
          >
            <Upload className="h-4 w-4" />
          </button>

          {showFilterControls && (
            <div className="relative bucket-filter-dropdown">
              <button
                type="button"
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className="flex items-center gap-1 rounded-lg border border-theme-neutral-300 px-2.5 py-1.5 text-xs text-theme-text-secondary hover:bg-[rgba(252,250,248,0.5)] transition-colors"
                aria-haspopup="listbox"
                aria-expanded={isFilterDropdownOpen}
              >
                <span className="truncate max-w-[100px]">{getFilterDisplayText()}</span>
                <svg className={`h-3 w-3 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isFilterDropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-theme-neutral-300 bg-white shadow-warm-lg">
                  <div className="py-1">
                    <label className="flex cursor-pointer items-center px-3 py-1.5 hover:bg-[rgba(252,250,248,0.5)]">
                      <input type="checkbox" checked={selectedBucketFilters.includes('all')} onChange={() => toggleBucketFilter('all')} className="mr-2 h-3 w-3 rounded accent-theme-primary" />
                      <span className="text-xs text-theme-text-secondary">All Categories</span>
                    </label>
                    {filterableBuckets.map((bucket) => (
                      <label key={bucket} className="flex cursor-pointer items-center px-3 py-1.5 hover:bg-[rgba(252,250,248,0.5)]">
                        <input type="checkbox" checked={selectedBucketFilters.includes(bucket)} onChange={() => toggleBucketFilter(bucket)} className="mr-2 h-3 w-3 rounded accent-theme-primary" />
                        <span className="text-xs text-theme-text-secondary">{bucket}</span>
                      </label>
                    ))}
                    {filterableBuckets.length > 0 && (
                      <label className="flex cursor-pointer items-center px-3 py-1.5 hover:bg-[rgba(252,250,248,0.5)]">
                        <input type="checkbox" checked={selectedBucketFilters.includes('unassigned')} onChange={() => toggleBucketFilter('unassigned')} className="mr-2 h-3 w-3 rounded accent-theme-primary" />
                        <span className="text-xs text-theme-text-secondary">Unassigned</span>
                      </label>
                    )}
                    {googleEvents.length > 0 && (
                      <label className="flex cursor-pointer items-center px-3 py-1.5 hover:bg-[rgba(252,250,248,0.5)]">
                        <input type="checkbox" checked={selectedBucketFilters.includes('google')} onChange={() => toggleBucketFilter('google')} className="mr-2 h-3 w-3 rounded accent-theme-primary" />
                        <span className="text-xs text-theme-text-secondary">Google Calendar</span>
                      </label>
                    )}
                    {uploadedEvents.length > 0 && (
                      <label className="flex cursor-pointer items-center px-3 py-1.5 hover:bg-[rgba(252,250,248,0.5)]">
                        <input type="checkbox" checked={selectedBucketFilters.includes('uploaded')} onChange={() => toggleBucketFilter('uploaded')} className="mr-2 h-3 w-3 rounded accent-theme-primary" />
                        <span className="text-xs text-theme-text-secondary">Uploaded Calendar</span>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Calendar Grid */}
      {view === 'agenda' ? (
        // Agenda view: Mobile-optimized scrollable list
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2">
            {agendaDays.map(({ date, dateStr, events, isToday }) => (
              <div key={dateStr}>
                {/* Day header */}
                <div className="flex items-center gap-3 py-3 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                  <div className={`flex flex-col items-center w-11 shrink-0 ${isToday ? 'text-red-500' : 'text-theme-text-tertiary'}`}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider">{format(date, 'EEE')}</span>
                    <span className={`text-lg font-bold leading-none mt-0.5 ${
                      isToday ? 'bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center' : ''
                    }`}>{format(date, 'd')}</span>
                  </div>
                  <div className="flex-1 border-t border-theme-neutral-300/40" />
                </div>

                {/* Now indicator for today */}
                {isToday && (
                  <div className="ml-11 pl-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <div className="flex-1 h-px bg-red-500" />
                      <span className="text-[10px] font-medium text-red-500 tabular-nums">{format(new Date(), 'h:mm a')}</span>
                    </div>
                  </div>
                )}

                {/* Event cards */}
                <div className="ml-11 pl-3 space-y-1.5 pb-2">
                  {events.length === 0 ? (
                    <p className="text-xs text-theme-text-quaternary italic py-2">No events scheduled</p>
                  ) : (
                    events.map((ev, idx) => {
                      const styles = resolveEventStyles(ev.source, ev);
                      const bucketColor = ev.bucket ? getBucketColorSync(normalizeBucketId(ev.bucket), bucketColors) : null;
                      const timeStr = ev.time && !ev.allDay
                        ? (() => { try { return format(new Date(ev.time), 'h:mm a'); } catch { return null; } })()
                        : ev.allDay ? 'All day' : null;
                      const durationStr = ev.duration ? `${ev.duration}m` : null;

                      return (
                        <button
                          key={`${ev.taskId || ev.eventId || idx}-${dateStr}`}
                          type="button"
                          onClick={() => openCalendarEvent(ev, dateStr)}
                          className="w-full text-left flex items-start gap-3 rounded-xl px-3 py-2.5 bg-white border border-theme-neutral-300/40 shadow-sm transition-all active:scale-[0.98]"
                          style={bucketColor ? { borderLeftColor: bucketColor, borderLeftWidth: 3 } : {}}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-theme-text-primary truncate">{ev.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {timeStr && (
                                <span className="text-[11px] text-theme-text-tertiary font-medium tabular-nums">{timeStr}</span>
                              )}
                              {durationStr && (
                                <span className="text-[11px] text-theme-text-quaternary">{durationStr}</span>
                              )}
                              {ev.location && (
                                <span className="text-[11px] text-theme-text-quaternary truncate max-w-[140px]">{ev.location}</span>
                              )}
                              {ev.bucket && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                  style={bucketColor ? { backgroundColor: bucketColor + '18', color: bucketColor } : {}}>
                                  {ev.bucket}
                                </span>
                              )}
                              {ev.repeatRule && ev.repeatRule !== 'none' && (
                                <span className="text-[10px] text-theme-text-quaternary">{getRepeatLabel(ev.repeatRule)}</span>
                              )}
                            </div>
                          </div>
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${styles.dot}`}
                            style={styles.customColor ? { backgroundColor: styles.customColor } : {}} />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
            {/* Bottom spacer */}
            <div className="h-20" />
          </div>

          {/* FAB - Add task */}
          <button
            type="button"
            onClick={() => taskEditorRef.current?.openNew(format(new Date(), 'yyyy-MM-dd'))}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-theme-primary text-white shadow-warm-lg flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Add task"
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        </div>
      ) : view === 'day' ? (
        // Day view: Enhanced Calidora-style
        <div className="w-full flex-1 flex flex-col">
          <div className="bg-theme-surface-base overflow-hidden flex-1 flex flex-col">
            {/* Enhanced Day Header */}
            <div className={`border-b border-theme-neutral-300/50 bg-gradient-to-b from-theme-surface-alt/60 to-theme-surface-base ${isCompactBreakpoint ? 'px-3 pt-3 pb-2' : 'px-5 pt-4 pb-3'}`}>
              <div className={`flex justify-between ${isCompactBreakpoint ? 'items-center gap-2' : 'items-start gap-4'}`}>
                <div className="min-w-0 flex-1">
                  {isCompactBreakpoint ? (
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-theme-text-primary tracking-tight truncate">
                        {format(currentDate, "EEE, MMM d")}
                      </h2>
                      <StickerRow
                        dayStr={currentDateKey}
                        className="flex"
                        stickersByDate={stickersByDate}
                        maxStickersPerDay={MAX_STICKERS_PER_DAY}
                        activeStickerDay={activeStickerDay}
                        setActiveStickerDay={setActiveStickerDay}
                        setStickerPalettePosition={setStickerPalettePosition}
                        stickerTriggerRef={stickerTriggerRef}
                        removeStickerFromDate={removeStickerFromDate}
                      />
                    </div>
                  ) : (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-[1.2px] text-theme-text-tertiary mb-0.5">
                        {format(currentDate, "EEEE")}
                      </p>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-semibold text-theme-text-primary tracking-tight">
                          {format(currentDate, "MMMM d, yyyy")}
                        </h2>
                        <StickerRow
                          dayStr={currentDateKey}
                          className="flex"
                          stickersByDate={stickersByDate}
                          maxStickersPerDay={MAX_STICKERS_PER_DAY}
                          activeStickerDay={activeStickerDay}
                          setActiveStickerDay={setActiveStickerDay}
                          setStickerPalettePosition={setStickerPalettePosition}
                          stickerTriggerRef={stickerTriggerRef}
                          removeStickerFromDate={removeStickerFromDate}
                        />
                      </div>
                    </>
                  )}

                  {/* Day Summary Stats — hidden on mobile when all empty */}
                  {(!isCompactBreakpoint || dayViewStats.taskCount > 0 || dayViewStats.plannedLabel || dayViewStats.googleCount > 0) && (
                    <div className={`flex items-center flex-wrap ${isCompactBreakpoint ? 'gap-1.5 mt-1.5' : 'gap-3 mt-2.5'}`}>
                      {dayViewStats.taskCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-theme-brand-tint-subtle px-2.5 py-1 text-[11px] font-medium text-theme-text-secondary">
                          <CheckCircle2 size={12} className="text-theme-primary-500" />
                          {dayViewStats.taskCount} {dayViewStats.taskCount === 1 ? 'task' : 'tasks'}
                        </span>
                      )}
                      {dayViewStats.plannedLabel && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-theme-brand-tint-subtle px-2.5 py-1 text-[11px] font-medium text-theme-text-secondary">
                          <Clock size={12} className="text-theme-primary-500" />
                          {dayViewStats.plannedLabel} planned
                        </span>
                      )}
                      {dayViewStats.googleCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600">
                          <CalendarDays size={12} />
                          {dayViewStats.googleCount} {dayViewStats.googleCount === 1 ? 'event' : 'events'}
                        </span>
                      )}
                      {!isCompactBreakpoint && dayViewStats.taskCount === 0 && !dayViewStats.plannedLabel && dayViewStats.googleCount === 0 && (
                        <span className="text-[11px] text-theme-text-quaternary italic">No events scheduled</span>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => hourlyPlannerRef.current?.openAddTaskModal()}
                  className={isCompactBreakpoint
                    ? "flex items-center justify-center rounded-full bg-theme-primary w-8 h-8 text-white shadow-warm-sm active:scale-[0.97] shrink-0"
                    : "flex items-center gap-2 rounded-lg bg-theme-primary px-3.5 py-2 text-xs font-medium text-white shadow-warm-sm transition-all hover:bg-[#a8896a] hover:shadow-warm active:scale-[0.97]"
                  }
                >
                  <Plus size={isCompactBreakpoint ? 16 : 14} strokeWidth={2.5} />
                  {!isCompactBreakpoint && <span>Add task</span>}
                </button>
              </div>

              {/* All-day events strip — always rendered so dnd can clean up drop animations */}
              <Droppable droppableId="allday-strip" direction="horizontal">
                {(alldayProvided) => (
                  <div
                    ref={alldayProvided.innerRef}
                    {...alldayProvided.droppableProps}
                    className="flex items-center gap-2 mt-3 pt-2.5 border-t border-theme-neutral-300/30"
                    style={dayViewStats.allDayEvents.length === 0 ? { height: 0, overflow: 'hidden', margin: 0, padding: 0, border: 'none' } : undefined}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[1px] text-theme-text-quaternary shrink-0">All day</span>
                    <div className="flex flex-wrap gap-1.5">
                      {dayViewStats.allDayEvents.map((event, idx) => {
                        const bucketColor = event.bucket ? getBucketColorSync(event.bucket, bucketColors) : null;
                        const draggableTaskId = event.taskId;
                        if (!draggableTaskId) {
                          return (
                            <span
                              key={`allday-${idx}`}
                              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-theme-text-secondary bg-theme-surface-alt border border-theme-neutral-300/40 shadow-sm"
                              style={bucketColor ? { borderLeftColor: bucketColor, borderLeftWidth: 3 } : {}}
                              title={event.title}
                            >
                              <span className="truncate max-w-[180px]">{event.title}</span>
                            </span>
                          );
                        }
                        return (
                          <Draggable
                            key={`allday-${draggableTaskId}`}
                            draggableId={`allday::${draggableTaskId}`}
                            index={idx}
                          >
                            {(dragProv, dragSnap) => (
                              <span
                                ref={dragProv.innerRef}
                                {...dragProv.draggableProps}
                                {...dragProv.dragHandleProps}
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-theme-text-secondary bg-white border border-theme-neutral-300/50 cursor-grab active:cursor-grabbing transition-all ${
                                  dragSnap.isDragging ? 'shadow-warm-lg ring-2 ring-theme-primary-300/60 scale-105 bg-white' : 'shadow-sm hover:shadow-warm hover:border-theme-primary-300/60'
                                }`}
                                style={{
                                  ...(dragProv.draggableProps.style || {}),
                                  ...(bucketColor ? { borderLeftColor: bucketColor, borderLeftWidth: 3 } : {}),
                                }}
                                title={`${event.title} — drag to a time slot to schedule`}
                              >
                                <GripVertical size={10} className="text-theme-text-quaternary shrink-0 -ml-0.5" />
                                <span className="truncate max-w-[180px]">{event.title}</span>
                              </span>
                            )}
                          </Draggable>
                        );
                      })}
                      {alldayProvided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            </div>

            <div className="p-4 space-y-3 flex-1 flex flex-col min-h-0">
              {/* Imported calendar events */}
              {importedDayEvents.length > 0 && (
                <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-100">
                        <CalendarDays size={13} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-amber-800">Imported Calendar</p>
                        <p className="text-[11px] text-amber-600/80">{importedDayEvents.length} {importedDayEvents.length === 1 ? 'event' : 'events'} from your uploaded calendar</p>
                      </div>
                    </div>
                  </div>

                  {importedTimedEvents.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {importedTimedEvents.map((event, idx) => {
                        const displayTime = event.parsedTime ? format(event.parsedTime, 'h:mm a') : '';
                        return (
                          <div
                            key={`${event.eventId || event.taskId || idx}-timed-${idx}`}
                            className="flex items-center justify-between gap-3 rounded-lg border border-amber-200/60 bg-white/80 px-3 py-2"
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                              <p className="text-sm font-medium text-amber-900 truncate" title={event.title}>{event.title}</p>
                              {event.location && (
                                <p className="text-[11px] text-amber-600 truncate hidden sm:block" title={event.location}>{event.location}</p>
                              )}
                            </div>
                            {displayTime && (
                              <span className="flex-shrink-0 rounded-md bg-amber-100/80 px-2 py-0.5 text-[11px] font-semibold text-amber-700 tabular-nums">
                                {displayTime}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {importedAllDayEvents.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {importedAllDayEvents.map((event, idx) => (
                        <span
                          key={`${event.eventId || event.title}-all-day-${idx}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/60 bg-white/80 px-2.5 py-0.5 text-[11px] font-medium text-amber-700"
                          title={event.title}
                        >
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                          <span className="truncate max-w-[160px]">{event.title}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Large Droppable wrapper so sidebar→calendar drops always land */}
              <Droppable droppableId="hourly-planner-drop">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`relative flex-1 rounded-xl transition-colors duration-150 ${
                      snapshot.isDraggingOver ? 'ring-2 ring-theme-primary-300/50' : ''
                    }`}
                  >
                    <HourlyPlanner
                      ref={hourlyPlannerRef}
                      className="max-h-[75vh] overflow-y-auto rounded-xl flex-1"
                      showTimeIndicator={true}
                      allowResize={true}
                      availableBuckets={availableBuckets}
                      selectedBucket={selectedBucket}
                      isDragging={isDragging}
                      wrapWithContext={false}
                      plannerDate={format(currentDate, 'yyyy-MM-dd')}
                      onTaskOpen={openTaskEditorById}
                      bucketColors={bucketColors}
                      isMobile={isCompactBreakpoint}
                    />
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 flex flex-col">
          <div className="overflow-x-auto sm:overflow-visible flex-1 flex flex-col">
            <div className={`sm:w-full ${multiDayMinWidth} sm:min-w-0 flex-1 flex flex-col`}>
              {view === 'week' ? (
                isCompactBreakpoint ? (
                  // ── MOBILE WEEK: 3-day horizontal scroll ──
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Scrollable header */}
                    <div
                      className="overflow-x-auto scrollbar-none border-b border-theme-neutral-300/60"
                      style={{ scrollbarWidth: 'none' }}
                      ref={mobileWeekScrollRef}
                      onScroll={syncMobileWeekScroll}
                    >
                      <div
                        className="grid"
                        style={{ gridTemplateColumns: 'repeat(7, calc((100vw - 1rem) / 3))' }}
                      >
                        {rows.flat().map((day: Date, i: number) => {
                          const dayIsToday = isSameDay(day, today);
                          return (
                            <div
                              key={i}
                              className={`py-2 px-1 text-center ${i < 6 ? 'border-r border-theme-neutral-300/40' : ''}`}
                            >
                              <span className={`text-[10px] uppercase tracking-[0.6px] font-medium block ${
                                dayIsToday ? 'text-theme-primary' : 'text-theme-text-tertiary'
                              }`}>
                                {weekDayLabels[i]}
                              </span>
                              <button
                                type="button"
                                onClick={() => { handleDateChange(day); handleViewChange('day'); }}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium mt-0.5 ${
                                  dayIsToday
                                    ? 'bg-theme-primary text-white'
                                    : 'text-theme-text-primary active:bg-theme-brand-tint-strong'
                                }`}
                              >
                                {format(day, 'd')}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Scrollable body — 3 columns visible, snaps per day */}
                    <div
                      className="overflow-x-auto flex-1 min-h-[420px] scrollbar-none"
                      style={{
                        scrollbarWidth: 'none',
                        scrollSnapType: 'x mandatory',
                        WebkitOverflowScrolling: 'touch',
                      }}
                      ref={mobileWeekBodyRef}
                      onScroll={syncMobileWeekScroll}
                    >
                      <div
                        className="grid h-full"
                        style={{ gridTemplateColumns: 'repeat(7, calc((100vw - 1rem) / 3))' }}
                      >
                        {rows.flat().map((day: Date, idx: number) => {
                          const dayStr = toDayKey(day);
                          const dayEvents = eventsByDate[dayStr] ?? [];
                          const dayIsToday = isSameDay(day, today);
                          const formattedDayLabel = format(day, 'MMMM d, yyyy');
                          const dayOfWeek = day.getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                          const visibleEvents = getEventsForDisplay(dayEvents);

                          return (
                            <Droppable key={`droppable-${dayStr}-${idx}`} droppableId={`calendar-day-${dayStr}`}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`h-full ${idx < 6 ? 'border-r border-theme-neutral-300/40' : ''}`}
                                  style={{ scrollSnapAlign: 'start' }}
                                >
                                  <div className={`px-2 pt-2 pb-3 h-full ${
                                    snapshot.isDraggingOver
                                      ? 'bg-theme-brand-tint-light'
                                      : isWeekend
                                      ? 'bg-[rgba(250,249,247,0.6)]'
                                      : 'bg-white'
                                  }`}>
                                    {/* Add task button — always visible on mobile */}
                                    <div className="flex items-center justify-end mb-2">
                                      <button
                                        type="button"
                                        className="lb-day-add p-0.5 rounded active:bg-theme-brand-tint-strong text-theme-text-tertiary transition-all"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedModalDate(null);
                                          taskEditorRef.current?.openNew(dayStr);
                                        }}
                                        title={`Add task on ${formattedDayLabel}`}
                                        aria-label={`Add task on ${formattedDayLabel}`}
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </button>
                                    </div>

                                    {/* Event pills */}
                                    <div className="flex flex-col gap-1">
                                      {visibleEvents.map((ev: DayEvent, filteredIndex: number) => {
                                        const styles = resolveEventStyles(ev.source, ev);
                                        const hasTask = Boolean(ev.taskId);
                                        const canEditEvent = ev.source === 'lifeboard' || ev.source === 'uploaded' || ev.source === 'google';
                                        const draggableId = hasTask
                                          ? `lifeboard::${ev.taskId}`
                                          : `event::${dayStr}::${filteredIndex}`;

                                        return (
                                          <Draggable
                                            key={draggableId}
                                            draggableId={draggableId}
                                            index={filteredIndex}
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
                                                  await openCalendarEvent(ev, dayStr);
                                                }}
                                                className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-left transition-all active:bg-theme-surface-alt/80 ${
                                                  dragSnapshot.isDragging ? 'opacity-40 shadow-sm' : ''
                                                }`}
                                                style={styles.customColor ? { backgroundColor: styles.customColor + '12' } : {}}
                                                title={ev.title}
                                                data-task-id={ev.taskId}
                                              >
                                                <span
                                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`}
                                                  style={styles.customColor ? { backgroundColor: styles.customColor } : {}}
                                                />
                                                <span className="text-[11px] leading-tight text-theme-text-primary truncate">
                                                  {ev.title}
                                                </span>
                                              </div>
                                            )}
                                          </Draggable>
                                        );
                                      })}
                                    </div>
                                    {provided.placeholder}
                                  </div>
                                </div>
                              )}
                            </Droppable>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  // ── DESKTOP WEEK: unchanged 7-column grid ──
                  <div className="flex-1 flex flex-col">
                    {weekdayHeader}
                    <div className="grid grid-cols-7 flex-1 min-h-[520px]">
                      {rows.flat().map((day: Date, idx: number) => {
                const dayStr = toDayKey(day);
                const dayEvents = eventsByDate[dayStr] ?? [];
                const isToday = isSameDay(day, today);
                const formattedDayLabel = format(day, 'MMMM d, yyyy');
                const dayOfWeek = day.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                return (
                  <Droppable key={`droppable-${dayStr}-${idx}`} droppableId={`calendar-day-${dayStr}`}>
                    {(provided, snapshot) => {
                      const cellClasses = [
                        'px-2 pt-2 pb-3 transition-colors relative group h-full',
                        snapshot.isDraggingOver
                          ? 'bg-theme-brand-tint-light'
                          : isWeekend
                          ? 'bg-[rgba(250,249,247,0.6)]'
                          : 'bg-white',
                      ].filter(Boolean).join(' ');
                      const visibleEvents = getEventsForDisplay(dayEvents);
                      const filteredEvents = visibleEvents;
                      return (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`h-full ${idx < 6 ? 'border-r border-theme-neutral-300/40' : ''}`}
                        >
                          <div
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest('.lb-day-add') || target.closest('.lb-sticker-add')) return;
                              if (dayEvents.length) setSelectedModalDate(dayStr);
                            }}
                            className={cellClasses}
                          >
                          {/* Day Number */}
                          <div className="flex items-center justify-between mb-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDateChange(day); handleViewChange('day'); }}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium hover:bg-theme-brand-tint-strong transition-colors ${
                                isToday
                                  ? 'bg-theme-primary text-white hover:bg-[#a8896a]'
                                  : 'text-theme-text-primary'
                              }`}
                            >
                              {format(day, "d")}
                            </button>
                            <div className="flex items-center gap-0.5">
                              <StickerAddButtonCompact
                                dayStr={dayStr}
                                stickersByDate={stickersByDate}
                                maxStickersPerDay={MAX_STICKERS_PER_DAY}
                                activeStickerDay={activeStickerDay}
                                setActiveStickerDay={setActiveStickerDay}
                                setStickerPalettePosition={setStickerPalettePosition}
                                stickerTriggerRef={stickerTriggerRef}
                              />
                              <button
                                type="button"
                                className="lb-day-add opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-theme-brand-tint-strong text-theme-text-tertiary hover:text-theme-text-secondary transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedModalDate(null);
                                  taskEditorRef.current?.openNew(dayStr);
                                }}
                                title={`Add task on ${formattedDayLabel}`}
                                aria-label={`Add task on ${formattedDayLabel}`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Sticker chips */}
                          <StickerChips dayStr={dayStr} stickersByDate={stickersByDate} onRemove={removeStickerFromDate} size="md" />

                          {/* Compact event pills */}
                          <div className="flex flex-col gap-1">
                            {filteredEvents.map((ev: DayEvent, filteredIndex: number) => {
                                const styles = resolveEventStyles(ev.source, ev);
                                const hasTask = Boolean(ev.taskId);
                                const canEditEvent = ev.source === 'lifeboard' || ev.source === 'uploaded' || ev.source === 'google';
                                const draggableId = hasTask
                                  ? `lifeboard::${ev.taskId}`
                                  : `event::${dayStr}::${filteredIndex}`;

                                return (
                                  <Draggable
                                    key={draggableId}
                                    draggableId={draggableId}
                                    index={filteredIndex}
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
                                          await openCalendarEvent(ev, dayStr);
                                        }}
                                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-left transition-all hover:bg-theme-surface-alt/80 cursor-grab active:cursor-grabbing ${
                                          dragSnapshot.isDragging ? 'opacity-40 shadow-sm' : ''
                                        }`}
                                        style={styles.customColor ? { backgroundColor: styles.customColor + '12' } : {}}
                                        title={ev.title}
                                        data-task-id={ev.taskId}
                                      >
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`}
                                          style={styles.customColor ? { backgroundColor: styles.customColor } : {}}
                                        />
                                        <span className="text-[11px] leading-tight text-theme-text-primary truncate">
                                          {ev.title}
                                        </span>
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                          </div>
                          {provided.placeholder}
                          </div>
                        </div>
                      );
                    }}
                  </Droppable>
                );
              })}
                    </div>
                  </div>
                )
              ) : (
                // Month view: Calidora-style grid
                <div className="flex-1 flex flex-col">
                  {weekdayHeader}
                  <div className={`grid grid-cols-7 flex-1 ${isCompactBreakpoint ? 'auto-rows-[minmax(52px,_1fr)]' : 'auto-rows-[minmax(120px,_1fr)]'}`}>
              {rows.flat().map((day: Date, idx: number) => {
                const dayStr = toDayKey(day);
                const dayEvents = eventsByDate[dayStr] ?? [];

                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, today);
                const formattedDayLabel = format(day, 'MMMM d, yyyy');
                const mobileDayLabel = format(day, 'EEE');
                const isLastRow = idx >= (rows.length - 1) * 7;

                return (
                  <Droppable key={`droppable-${dayStr}-${idx}`} droppableId={`calendar-day-${dayStr}`}>
                    {(provided, snapshot) => {
                      const dayOfWeek = day.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const borderClasses = [
                        idx % 7 < 6 ? 'border-r' : '',
                        !isLastRow ? 'border-b' : '',
                      ].filter(Boolean).join(' ');
                      const cellClasses = [
                        'p-2 transition-colors relative group h-full',
                        snapshot.isDraggingOver
                          ? 'bg-theme-brand-tint-light'
                          : isCurrentMonth
                          ? 'bg-white'
                          : 'bg-[rgba(252,250,248,0.3)]',
                      ].filter(Boolean).join(' ');

                      const displayEvents = getEventsForDisplay(dayEvents);
                      const filteredEvents = displayEvents;

                      if (isCompactBreakpoint) {
                        // MOBILE: Compact cell with dots
                        return (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`h-full border-theme-neutral-300/50 ${borderClasses}`}
                          >
                            <button
                              type="button"
                              onClick={() => { handleDateChange(day); handleViewChange('day'); }}
                              className={`w-full h-full p-1 flex flex-col items-center justify-start transition-colors ${
                                snapshot.isDraggingOver ? 'bg-theme-brand-tint-light'
                                : isCurrentMonth ? 'bg-white' : 'bg-[rgba(252,250,248,0.3)]'
                              }`}
                            >
                              <span className={`text-xs w-7 h-7 flex items-center justify-center rounded-full ${
                                isToday ? 'bg-theme-primary text-white font-semibold'
                                : isCurrentMonth ? 'text-theme-text-secondary' : 'text-theme-text-quaternary'
                              }`}>
                                {format(day, 'd')}
                              </span>
                              {isCurrentMonth && dayEvents.length > 0 && (
                                <div className="flex items-center gap-[3px] mt-1">
                                  {dayEvents.slice(0, 3).map((ev, i) => {
                                    const dotStyles = resolveEventStyles(ev.source, ev);
                                    return (
                                      <span key={i} className={`w-[5px] h-[5px] rounded-full ${dotStyles.dot}`}
                                        style={dotStyles.customColor ? { backgroundColor: dotStyles.customColor } : {}} />
                                    );
                                  })}
                                </div>
                              )}
                            </button>
                            {provided.placeholder}
                          </div>
                        );
                      }

                      return (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`h-full border-theme-neutral-300/50 ${borderClasses}`}
                        >
                          <div
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest('.lb-day-add') || target.closest('.lb-sticker-add')) return;
                              if (dayEvents.length) setSelectedModalDate(dayStr);
                            }}
                            className={cellClasses}
                          >
                          {isCurrentMonth && (
                            <>
                          {/* Day Number */}
                          <div className="flex items-center justify-between mb-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDateChange(day); handleViewChange('day'); }}
                              className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                                isToday ? 'bg-theme-primary text-white hover:bg-[#a8896a]' : 'text-theme-text-secondary hover:bg-theme-brand-tint-strong'
                              }`}
                            >
                              <span className="text-xs">{format(day, "d")}</span>
                            </button>
                            <div className="flex items-center gap-0.5">
                              <StickerAddButtonCompact
                                dayStr={dayStr}
                                stickersByDate={stickersByDate}
                                maxStickersPerDay={MAX_STICKERS_PER_DAY}
                                activeStickerDay={activeStickerDay}
                                setActiveStickerDay={setActiveStickerDay}
                                setStickerPalettePosition={setStickerPalettePosition}
                                stickerTriggerRef={stickerTriggerRef}
                              />
                              <button
                                type="button"
                                className="lb-day-add opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-theme-brand-tint-strong text-theme-text-tertiary hover:text-theme-text-secondary transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedModalDate(null);
                                  taskEditorRef.current?.openNew(dayStr);
                                }}
                                title={`Add task on ${formattedDayLabel}`}
                                aria-label={`Add task on ${formattedDayLabel}`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Sticker chips */}
                          <StickerChips dayStr={dayStr} stickersByDate={stickersByDate} onRemove={removeStickerFromDate} size="sm" />

                          {/* Calidora-style compact event pills */}
                          <div className="flex flex-col gap-1">
                            {filteredEvents.slice(0, 3).map((ev: DayEvent, filteredIndex: number) => {
                                const styles = resolveEventStyles(ev.source, ev);
                                const hasTask = Boolean(ev.taskId);
                                const canEditEvent = ev.source === 'lifeboard' || ev.source === 'uploaded' || ev.source === 'google';
                                const draggableId = hasTask
                                  ? `lifeboard::${ev.taskId}`
                                  : `event::${dayStr}::${filteredIndex}`;

                                return (
                                  <Draggable
                                    key={draggableId}
                                    draggableId={draggableId}
                                    index={filteredIndex}
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
                                          await openCalendarEvent(ev, dayStr);
                                        }}
                                        className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md text-left transition-colors hover:bg-[rgba(252,250,248,0.8)] cursor-grab active:cursor-grabbing ${
                                          dragSnapshot.isDragging ? 'opacity-40' : ''
                                        }`}
                                        style={styles.customColor ? { backgroundColor: styles.customColor + '12' } : {}}
                                        title={ev.title}
                                      >
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`}
                                          style={styles.customColor ? { backgroundColor: styles.customColor } : {}}
                                        />
                                        <span className="text-[11px] text-theme-text-primary truncate">
                                          {ev.title}
                                        </span>
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                            {dayEvents.length > 3 && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedModalDate(dayStr);
                                }}
                                className="text-[10px] text-theme-text-tertiary pl-1.5 hover:text-theme-text-secondary transition-colors text-left"
                              >
                                +{dayEvents.length - 3} more
                              </button>
                            )}
                          </div>
                          </>
                          )}
                          {provided.placeholder}
                          </div>
                        </div>
                      );
                    }}
                  </Droppable>
                );
              })}
                  </div>
                </div>
              )}
            </div>
          </div>
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
            role="dialog"
            aria-modal="true"
            aria-label="Calendar event details"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">{selectedModalDate ? format(parseISO(selectedModalDate), 'MMMM d, yyyy') : 'Event Details'}</h3>
              <button
                type="button"
                onClick={() => setSelectedModalDate(null)}
                className="text-theme-text-tertiary/70 hover:text-theme-text-subtle rounded-md focus:outline-none"
                aria-label="Close event details"
              >
                &times;
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-auto">
              {(eventsByDate[selectedModalDate || ''] ?? []).map((ev: DayEvent, idx: number) => {
                const getDotColor = (source: string, ev?: DayEvent) => {
                  switch (source) {
                    case 'google':
                      return 'bg-theme-primary-500';
                    case 'uploaded':
                      return 'bg-purple-500';
                    case 'lifeboard':
                      const styles = getBucketEventStyles(ev?.bucket, bucketColors);
                      return styles.customColor || styles.dot;
                    default:
                      return 'bg-theme-surface-alt0';
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
                
                const modalBgColor = ev.source === 'lifeboard' && typeof getDotColor(ev.source, ev) === 'string' && getDotColor(ev.source, ev).startsWith('#')
                  ? getDotColor(ev.source, ev) + '12'
                  : '#f5f5f5';

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-4 rounded-2xl transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5"
                    style={{
                      backgroundColor: modalBgColor,
                      border: 'none'
                    }}
                  >
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-theme-text-primary leading-snug">{ev.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-theme-text-tertiary">
                        <span className="inline-flex items-center px-2 py-0.5 bg-white/60 rounded-lg font-medium">
                          {getSourceLabel(ev.source)}
                        </span>
                        {ev.time && (
                          <span className="font-medium">
                            {ev.allDay ? 'All day' : format(new Date(ev.time), 'h:mm a')}
                            {ev.duration && ev.source === 'lifeboard' && (
                              <span className="ml-1 text-theme-text-tertiary/70">• {ev.duration} min</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {(eventsByDate[selectedModalDate || '']?.length ?? 0) === 0 && (
                <p className="text-sm text-theme-text-tertiary">No events</p>
              )}
            </div>
          </div>
        </div>
      )}

      <TaskEditorModal
        ref={taskEditorRef}
        availableBuckets={availableBuckets}
        selectedBucket={selectedBucket}
        getDefaultDate={taskEditorDefaultDate}
        bucketColors={bucketColors}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDeleteConfirmTask(null)}
        >
          <div
            className="bg-white rounded-lg w-96 max-w-[90%] p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Delete task confirmation"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-theme-text-primary">Delete Task</h3>
                <p className="text-sm text-theme-text-subtle mt-1">
                  Are you sure you want to delete this task?
                </p>
              </div>
              <button
                type="button"
                className="text-theme-text-tertiary/70 hover:text-theme-text-subtle"
                onClick={() => setDeleteConfirmTask(null)}
                aria-label="Close delete confirmation"
              >
                &times;
              </button>
            </div>

            <div className="bg-theme-surface-alt rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-theme-text-primary truncate">
                {deleteConfirmTask.title}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm rounded border border-theme-neutral-300 text-theme-text-body hover:bg-theme-surface-alt transition-colors"
                onClick={() => setDeleteConfirmTask(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                onClick={async () => {
                  try {
                    await deleteTask(deleteConfirmTask.id, deleteConfirmTask.date);
                    setDeleteConfirmTask(null);
                    
                    // Remove from local event state to update UI immediately
                    setEventsByDate(prev => {
                      const updated = { ...prev } as Record<string, DayEvent[]>;
                      const targetDate = deleteConfirmTask.date;
                      if (targetDate && updated[targetDate]) {
                        updated[targetDate] = updated[targetDate].filter(ev => ev.taskId !== deleteConfirmTask.id);
                        if (updated[targetDate].length === 0) delete updated[targetDate];
                      } else {
                        Object.keys(updated).forEach(dateKey => {
                          updated[dateKey] = updated[dateKey].filter(ev => ev.taskId !== deleteConfirmTask.id);
                          if (updated[dateKey].length === 0) delete updated[dateKey];
                        });
                      }
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

      {/* Shared sticker palette — single instance for all views */}
      {activeStickerDay && stickerPalettePosition && (
        <StickerPalette
          dayStr={activeStickerDay}
          dayStickers={stickersByDate[activeStickerDay] ?? []}
          maxStickersPerDay={MAX_STICKERS_PER_DAY}
          position={stickerPalettePosition}
          paletteRef={stickerPaletteRef}
          onAdd={(id) => addStickerToDate(activeStickerDay, id)}
          onRemove={(id) => removeStickerFromDate(activeStickerDay, id)}
          onClear={() => { clearStickersForDate(activeStickerDay); setActiveStickerDay(null); }}
          onClose={() => setActiveStickerDay(null)}
        />
      )}

      {/* Upload Calendar Modal */}
      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setIsUploadModalOpen(false)}
        >
          <div
            className="max-w-4xl w-full mx-4"
            role="dialog"
            aria-modal="true"
            aria-label="Upload calendar file"
            onClick={(event) => event.stopPropagation()}
          >
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
