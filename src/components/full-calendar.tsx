"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
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
import { Plus, Upload, Sparkles, Heart, Coffee, Sun, BookOpen, Dumbbell, Sticker } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import HourlyPlanner, { HourlyPlannerHandle } from "@/components/hourly-planner";
import TaskEditorModal, { TaskEditorModalHandle } from "@/components/task-editor-modal";
import { useTasksContext } from "@/contexts/tasks-context";
import type { RepeatOption, Task } from "@/hooks/use-tasks";
import { useDataCache } from "@/hooks/use-data-cache";
import { getBucketColorSync, UNASSIGNED_BUCKET_ID } from "@/lib/bucket-colors";
import { getUserPreferencesClient } from "@/lib/user-preferences";
import { useCalendarStickers, MAX_STICKERS_PER_DAY } from "@/hooks/use-calendar-stickers";
import { sanitizeBucketName, isoToHourLabel } from "@/lib/task-form-utils";

type CalendarView = 'month' | 'week' | 'day';

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

interface StickerOption {
  id: string;
  label: string;
  icon: LucideIcon;
  backgroundClass: string;
  textClass: string;
  ringClass: string;
}

const STICKER_OPTIONS: StickerOption[] = [
  {
    id: 'celebrate',
    label: 'Celebrate',
    icon: Sparkles,
    backgroundClass: 'bg-pink-50',
    textClass: 'text-pink-500',
    ringClass: 'ring-pink-200/70',
  },
  {
    id: 'self-care',
    label: 'Self-care',
    icon: Heart,
    backgroundClass: 'bg-rose-50',
    textClass: 'text-rose-500',
    ringClass: 'ring-rose-200/70',
  },
  {
    id: 'coffee-break',
    label: 'Coffee',
    icon: Coffee,
    backgroundClass: 'bg-amber-50',
    textClass: 'text-amber-600',
    ringClass: 'ring-amber-200/70',
  },
  {
    id: 'sunshine',
    label: 'Sunshine',
    icon: Sun,
    backgroundClass: 'bg-yellow-50',
    textClass: 'text-yellow-500',
    ringClass: 'ring-yellow-200/70',
  },
  {
    id: 'focus',
    label: 'Focus',
    icon: BookOpen,
    backgroundClass: 'bg-[#fdf8f6]',
    textClass: 'text-[#bb9e7b]',
    ringClass: 'ring-[#dbd6cf]/70',
  },
  {
    id: 'movement',
    label: 'Movement',
    icon: Dumbbell,
    backgroundClass: 'bg-emerald-50',
    textClass: 'text-emerald-600',
    ringClass: 'ring-emerald-200/70',
  },
];

const STICKER_LOOKUP: Record<string, StickerOption> = STICKER_OPTIONS.reduce((acc, option) => {
  acc[option.id] = option;
  return acc;
}, {} as Record<string, StickerOption>);

const STICKER_PALETTE_WIDTH = 208;
const STICKER_PALETTE_HEIGHT = 236;

const normalizeRepeatOption = (value: unknown): RepeatOption | undefined => {
  if (!value) return undefined;
  const normalized = String(value).toLowerCase();
  if (normalized === 'daily' || normalized === 'weekly' || normalized === 'weekdays' || normalized === 'monthly') {
    return normalized as RepeatOption;
  }
  return undefined;
};

const CalendarFileUpload = dynamic(
  () => import("@/components/calendar-file-upload").then((module) => module.CalendarFileUpload),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-[#dbd6cf] bg-white p-5 text-sm text-[#8e99a8] shadow-sm">
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
      container: 'bg-[#f0f3fe] border-l-4 border-[#6B8AF7] text-[#314158] hover:bg-[#e3e9fd]',
      time: 'text-[#5570c7]',
      dot: 'bg-[#6B8AF7]',
      badge: 'text-[#5570c7]'
    },
    "#48B882": { // green (Calidora)
      container: 'bg-[#eefaf3] border-l-4 border-[#48B882] text-[#314158] hover:bg-[#dcf5e7]',
      time: 'text-[#3a9468]',
      dot: 'bg-[#48B882]',
      badge: 'text-[#3a9468]'
    },
    "#D07AA4": { // rose (Calidora)
      container: 'bg-[#fdf1f6] border-l-4 border-[#D07AA4] text-[#314158] hover:bg-[#fbe3ed]',
      time: 'text-[#b05c86]',
      dot: 'bg-[#D07AA4]',
      badge: 'text-[#b05c86]'
    },
    "#4AADE0": { // sky blue (Calidora)
      container: 'bg-[#eef7fc] border-l-4 border-[#4AADE0] text-[#314158] hover:bg-[#dcf0fa]',
      time: 'text-[#3889b5]',
      dot: 'bg-[#4AADE0]',
      badge: 'text-[#3889b5]'
    },
    "#C4A44E": { // golden (Calidora)
      container: 'bg-[#faf6ec] border-l-4 border-[#C4A44E] text-[#314158] hover:bg-[#f5edd8]',
      time: 'text-[#9e843e]',
      dot: 'bg-[#C4A44E]',
      badge: 'text-[#9e843e]'
    },
    "#8B7FD4": { // plum (Calidora)
      container: 'bg-[#f3f1fb] border-l-4 border-[#8B7FD4] text-[#314158] hover:bg-[#e7e3f7]',
      time: 'text-[#6f65aa]',
      dot: 'bg-[#8B7FD4]',
      badge: 'text-[#6f65aa]'
    },
    "#E28A5D": { // orange (Calidora)
      container: 'bg-[#fdf3ee] border-l-4 border-[#E28A5D] text-[#314158] hover:bg-[#fbe7dc]',
      time: 'text-[#b56e4a]',
      dot: 'bg-[#E28A5D]',
      badge: 'text-[#b56e4a]'
    },
    "#5E9B8C": { // teal (Calidora)
      container: 'bg-[#eff7f5] border-l-4 border-[#5E9B8C] text-[#314158] hover:bg-[#dff0ec]',
      time: 'text-[#4b7c70]',
      dot: 'bg-[#5E9B8C]',
      badge: 'text-[#4b7c70]'
    },
    "#8e99a8": { // gray (unassigned - Calidora)
      container: 'bg-[#faf8f5] border-l-4 border-[#b8b0a8] text-[#314158] hover:bg-[rgba(183,148,106,0.08)]',
      time: 'text-[#6b7688]',
      dot: 'bg-[#b8b0a8]',
      badge: 'text-[#6b7688]'
    },
    // Legacy colors for backwards compatibility
    "#4F46E5": { // indigo (legacy)
      container: 'bg-[#fdf8f6] border-l-4 border-[#bb9e7b] text-[#314158] hover:bg-[#f5ede4]',
      time: 'text-[#9a7b5a]',
      dot: 'bg-[#bb9e7b]',
      badge: 'text-[#9a7b5a]'
    },
    "#94A3B8": { // gray (legacy unassigned)
      container: 'bg-[#faf8f5] border-l-4 border-[#b8b0a8] text-[#314158] hover:bg-[rgba(183,148,106,0.08)]',
      time: 'text-[#6b7688]',
      dot: 'bg-[#b8b0a8]',
      badge: 'text-[#6b7688]'
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
    container: 'border-l-4 text-[#314158] hover:opacity-90',
    time: 'text-[#6b7688]',
    dot: 'w-2 h-2 rounded-full',
    badge: 'text-[#6b7688]',
    customColor: color
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
  source: 'google' | 'todoist' | 'lifeboard' | 'uploaded';
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
  const [selectedStickerDate, setSelectedStickerDate] = useState<string | null>(null); // For date selection in header sticker mode
  const stickerPaletteRef = useRef<HTMLDivElement | null>(null);
  const stickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [stickerPalettePosition, setStickerPalettePosition] = useState<{ top: number; left: number } | null>(null);

  const computeStickerPalettePosition = useCallback((target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : STICKER_PALETTE_WIDTH;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : STICKER_PALETTE_HEIGHT;

    const preferredLeft = rect.left + rect.width / 2 - STICKER_PALETTE_WIDTH / 2;
    const clampedLeft = Math.min(
      Math.max(preferredLeft, 12),
      viewportWidth - STICKER_PALETTE_WIDTH - 12
    );

    const preferredTop = rect.bottom + 8;
    const clampedTop = Math.min(
      Math.max(preferredTop, 12),
      viewportHeight - STICKER_PALETTE_HEIGHT - 12
    );

    return { top: clampedTop, left: clampedLeft };
  }, []);

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

  // Component to display stickers on a date (without add button)
  const StickerDisplay = ({ dayStr, className }: { dayStr: string; className?: string }) => {
    const dayStickers = stickersByDate[dayStr] ?? [];
    const stickerButtonCommon = 'inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent shadow-sm transition hover:shadow-warm focus:outline-none focus:ring-[3px] focus:ring-[rgba(163,133,96,0.15)]';

    if (dayStickers.length === 0) return null;

    return (
      <div className={className ?? ''}>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {dayStickers.map((stickerId) => {
            const option = STICKER_LOOKUP[stickerId];
            if (!option) return null;
            const Icon = option.icon;
            return (
              <button
                key={`${dayStr}-${stickerId}`}
                type="button"
                title={`Remove ${option.label} sticker`}
                aria-label={`Remove ${option.label} sticker`}
                onClick={(event) => {
                  event.stopPropagation();
                  removeStickerFromDate(dayStr, stickerId);
                }}
                className={`${stickerButtonCommon} ${option.backgroundClass} ${option.textClass} ring-1 ${option.ringClass}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Component for add sticker button only (no sticker display) - for headers
  const StickerAddButton = ({ dayStr, className, showDatePicker = false }: { dayStr: string; className?: string; showDatePicker?: boolean }) => {
    const targetDate = showDatePicker && selectedStickerDate ? selectedStickerDate : dayStr;
    const dayStickers = stickersByDate[targetDate] ?? [];
    const isOpen = activeStickerDay === dayStr;
    const reachedLimit = dayStickers.length >= MAX_STICKERS_PER_DAY;

    return (
      <div className={className ?? ''}>
        <button
          type="button"
          ref={dayStr === activeStickerDay ? stickerTriggerRef : undefined}
          onClick={(event) => {
            event.stopPropagation();
            const target = event.currentTarget as HTMLButtonElement;

            if (activeStickerDay === dayStr) {
              setActiveStickerDay(null);
              setSelectedStickerDate(null);
              return;
            }

            stickerTriggerRef.current = target;
            setStickerPalettePosition(computeStickerPalettePosition(target));
            setActiveStickerDay(dayStr);
            if (showDatePicker) {
              setSelectedStickerDate(dayStr);
            }
          }}
          className={[
            'inline-flex items-center justify-center gap-1 rounded-full border border-dashed bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#6b7688] shadow-sm transition focus:outline-none focus:ring-[3px] focus:ring-[rgba(163,133,96,0.15)]',
            reachedLimit
              ? 'border-rose-200 text-rose-500 hover:border-rose-300 hover:text-rose-600'
              : 'border-[#dbd6cf] hover:border-[#bb9e7b] hover:text-[#9a7b5a]'
          ].join(' ')}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={reachedLimit ? `Sticker limit reached (${MAX_STICKERS_PER_DAY})` : 'Add sticker'}
          title={reachedLimit ? `Sticker limit reached (${MAX_STICKERS_PER_DAY})` : 'Add sticker'}
        >
          <Sticker className="h-3.5 w-3.5" />
          <span className="ml-1">Sticker</span>
        </button>

        {isOpen && stickerPalettePosition && typeof window !== 'undefined' && createPortal(
          <div
            ref={dayStr === activeStickerDay ? stickerPaletteRef : undefined}
            className="fixed z-[1200] max-h-[80vh] w-[208px] overflow-hidden rounded-xl border border-[#dbd6cf] bg-white/95 p-2 shadow-xl ring-1 ring-[#dbd6cf] backdrop-blur-sm"
            style={{ top: stickerPalettePosition.top, left: stickerPalettePosition.left }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-[#8e99a8]/70">
              <span>Choose sticker</span>
              <button
                type="button"
                className="text-[#8e99a8]/70 transition hover:text-[#6b7688] focus:outline-none focus:ring-1 focus:ring-[rgba(163,133,96,0.4)]"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveStickerDay(null);
                  setSelectedStickerDate(null);
                }}
              >
                Close
              </button>
            </div>

            {showDatePicker && (
              <div className="mb-3">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8e99a8]/70">
                  Select Date
                </label>
                <input
                  type="date"
                  value={selectedStickerDate || dayStr}
                  onChange={(e) => setSelectedStickerDate(e.target.value)}
                  className="w-full rounded-lg border border-[#dbd6cf] px-2 py-1.5 text-xs focus:border-[#bb9e7b] focus:outline-none focus:ring-1 focus:ring-[#bb9e7b]"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {STICKER_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = dayStickers.includes(option.id);
                const disabled = !isSelected && reachedLimit;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`flex h-14 flex-col items-center justify-center gap-1 rounded-lg border border-transparent bg-[#faf8f5] text-[#8e99a8] transition hover:bg-[rgba(183,148,106,0.08)] focus:outline-none focus:ring-[3px] focus:ring-[rgba(163,133,96,0.15)] ${
                      isSelected ? `${option.backgroundClass} ${option.textClass} ring-2 ${option.ringClass} shadow-sm` : ''
                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isSelected) {
                        removeStickerFromDate(targetDate, option.id);
                      } else if (!disabled) {
                        addStickerToDate(targetDate, option.id);
                      }
                    }}
                    aria-pressed={isSelected}
                    aria-label={isSelected ? `Remove ${option.label}` : `Add ${option.label}`}
                    disabled={disabled && !isSelected}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 space-y-1 text-[10px] text-[#8e99a8]/70">
              <p>{`Up to ${MAX_STICKERS_PER_DAY} stickers per day.`}</p>
              <p>Tap a sticker again to remove it.</p>
            </div>

            {dayStickers.length > 0 && (
              <button
                type="button"
                className="mt-2 w-full rounded-lg border border-[#dbd6cf] px-2 py-1 text-[11px] font-medium text-[#8e99a8] transition hover:bg-[#faf8f5] focus:outline-none focus:ring-1 focus:ring-[rgba(163,133,96,0.4)]"
                onClick={(event) => {
                  event.stopPropagation();
                  clearStickersForDate(targetDate);
                  setActiveStickerDay(null);
                  setSelectedStickerDate(null);
                }}
              >
                Clear stickers
              </button>
            )}
          </div>,
          document.body
        )}
      </div>
    );
  };

  const StickerRow = ({ dayStr, className }: { dayStr: string; className?: string }) => {
    const dayStickers = stickersByDate[dayStr] ?? [];
    const isOpen = activeStickerDay === dayStr;
    const reachedLimit = dayStickers.length >= MAX_STICKERS_PER_DAY;

    const stickerButtonCommon = 'inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent shadow-sm transition hover:shadow-warm focus:outline-none focus:ring-[3px] focus:ring-[rgba(163,133,96,0.15)]';

    return (
      <div className={className ?? ''}>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            ref={dayStr === activeStickerDay ? stickerTriggerRef : undefined}
            onClick={(event) => {
              event.stopPropagation();
              const target = event.currentTarget as HTMLButtonElement;

              if (activeStickerDay === dayStr) {
                setActiveStickerDay(null);
                return;
              }

              stickerTriggerRef.current = target;
              setStickerPalettePosition(computeStickerPalettePosition(target));
              setActiveStickerDay(dayStr);
            }}
            className={[
              'order-first inline-flex w-full items-center justify-center gap-1 rounded-full border border-dashed bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#6b7688] shadow-sm transition focus:outline-none focus:ring-[3px] focus:ring-[rgba(163,133,96,0.15)] sm:order-none sm:w-auto sm:px-3',
              reachedLimit
                ? 'border-rose-200 text-rose-500 hover:border-rose-300 hover:text-rose-600'
                : 'border-[#dbd6cf] hover:border-[#bb9e7b] hover:text-[#9a7b5a]'
            ].join(' ')}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-label={reachedLimit ? `Sticker limit reached (${MAX_STICKERS_PER_DAY})` : 'Add sticker'}
            title={reachedLimit ? `Sticker limit reached (${MAX_STICKERS_PER_DAY})` : 'Add sticker'}
          >
            <Sticker className="h-3.5 w-3.5" />
            <span className="ml-1">Sticker</span>
          </button>

          {dayStickers.map((stickerId) => {
            const option = STICKER_LOOKUP[stickerId];
            if (!option) return null;
            const Icon = option.icon;
            return (
              <button
                key={`${dayStr}-${stickerId}`}
                type="button"
                title={`Remove ${option.label} sticker`}
                aria-label={`Remove ${option.label} sticker`}
                onClick={(event) => {
                  event.stopPropagation();
                  removeStickerFromDate(dayStr, stickerId);
                }}
                className={`${stickerButtonCommon} ${option.backgroundClass} ${option.textClass} ring-1 ${option.ringClass}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>

        {isOpen && stickerPalettePosition && typeof window !== 'undefined' && createPortal(
          <div
            ref={dayStr === activeStickerDay ? stickerPaletteRef : undefined}
            className="fixed z-[1200] max-h-[80vh] w-[208px] overflow-hidden rounded-xl border border-[#dbd6cf] bg-white/95 p-2 shadow-xl ring-1 ring-[#dbd6cf] backdrop-blur-sm"
            style={{ top: stickerPalettePosition.top, left: stickerPalettePosition.left }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-[#8e99a8]/70">
              <span>Choose sticker</span>
              <button
                type="button"
                className="text-[#8e99a8]/70 transition hover:text-[#6b7688] focus:outline-none focus:ring-1 focus:ring-[rgba(163,133,96,0.4)]"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveStickerDay(null);
                }}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {STICKER_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = dayStickers.includes(option.id);
                const disabled = !isSelected && reachedLimit;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`flex h-14 flex-col items-center justify-center gap-1 rounded-lg border border-transparent bg-[#faf8f5] text-[#8e99a8] transition hover:bg-[rgba(183,148,106,0.08)] focus:outline-none focus:ring-[3px] focus:ring-[rgba(163,133,96,0.15)] ${
                      isSelected ? `${option.backgroundClass} ${option.textClass} ring-2 ${option.ringClass} shadow-sm` : ''
                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isSelected) {
                        removeStickerFromDate(dayStr, option.id);
                      } else if (!disabled) {
                        addStickerToDate(dayStr, option.id);
                      }
                    }}
                    aria-pressed={isSelected}
                    aria-label={isSelected ? `Remove ${option.label}` : `Add ${option.label}`}
                    disabled={disabled && !isSelected}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 space-y-1 text-[10px] text-[#8e99a8]/70">
              <p>{`Up to ${MAX_STICKERS_PER_DAY} stickers per day.`}</p>
              <p>Tap a sticker again to remove it.</p>
            </div>

            {dayStickers.length > 0 && (
              <button
                type="button"
                className="mt-2 w-full rounded-lg border border-[#dbd6cf] px-2 py-1 text-[11px] font-medium text-[#8e99a8] transition hover:bg-[#faf8f5] focus:outline-none focus:ring-1 focus:ring-[rgba(163,133,96,0.4)]"
                onClick={(event) => {
                  event.stopPropagation();
                  clearStickersForDate(dayStr);
                  setActiveStickerDay(null);
                }}
              >
                Clear stickers
              </button>
            )}
          </div>,
          document.body
        )}
      </div>
    );
  };

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
      if (savedView && ['month', 'week', 'day'].includes(savedView)) {
        return savedView as CalendarView;
      }
    }
    return 'day';
  });

  // Persist view changes to localStorage
  const handleViewChange = useCallback((newView: CalendarView) => {
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
  const today = new Date();
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

  useEffect(() => {
    setActiveStickerDay(null);
  }, [view, currentDateKey]);

  // Get tasks from context
  const { allTasks, deleteTask, refetch, getTaskForOccurrence, createTask } = useTasksContext();
  
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

  const normalizeDateString = useCallback((value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.length > 10 ? trimmed.slice(0, 10) : trimmed;
  }, []);

  const shouldIncludeTaskOnDate = useCallback((task: Task, dateStr: string): boolean => {
    if (!task || task.completed) return false;
    const normalizedStart = normalizeDateString(task.startDate ?? task.due?.date);
    if (!normalizedStart) return false;
    const normalizedEnd = normalizeDateString(task.endDate) ?? normalizedStart;
    const startDateStr = normalizedStart;
    const endDateStr = normalizedEnd;
    if (!startDateStr) return false;

    if (!task.repeatRule) {
      const targetDate = normalizeDateString(dateStr);
      if (!targetDate) return false;
      return targetDate >= startDateStr && targetDate <= endDateStr;
    }

    const target = new Date(`${dateStr}T00:00:00`);
    const due = new Date(`${startDateStr}T00:00:00`);
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
  }, [normalizeDateString]);

  const buildLifeboardEventsForDate = useCallback((dateStr: string): DayEvent[] => {
    const events: DayEvent[] = [];

    allTasks.forEach((task: Task) => {
      if (!shouldIncludeTaskOnDate(task, dateStr)) return;

      const adjustedTask = getTaskForOccurrence(task, dateStr);
      if (!adjustedTask) return;

      // Apply bucket filter - multi-select logic
      if (!selectedBucketFilters.includes('all')) {
        const taskBucket = adjustedTask.bucket || 'unassigned';
        if (!selectedBucketFilters.includes(taskBucket)) return;
      }

      const repeatRule = adjustedTask.repeatRule ? (adjustedTask.repeatRule as RepeatOption) : undefined;
      const startDateStr = adjustedTask.startDate ?? adjustedTask.due?.date;
      const endDateStr = adjustedTask.endDate ?? startDateStr;
      const isRangeStart = dateStr === startDateStr;
      const isRangeEnd = dateStr === endDateStr;
      const eventAllDay = adjustedTask.allDay ?? (!adjustedTask.hourSlot && !adjustedTask.endHourSlot);

      const baseEvent: DayEvent = {
        source: 'lifeboard',
        title: adjustedTask.content,
        allDay: eventAllDay,
        taskId: adjustedTask.id,
        repeatRule,
        bucket: adjustedTask.bucket,
        startDate: startDateStr ?? undefined,
        endDate: endDateStr ?? undefined,
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

      events.push(baseEvent);
    });

    return events;
  }, [allTasks, getTaskForOccurrence, hourSlotToISO, shouldIncludeTaskOnDate, selectedBucketFilters]);

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
          setSelectedStickerDate(null);
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

  const rows = useMemo(() => {
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

  // Listen for task updates from other components
  useEffect(() => {
    const handleTasksUpdated = () => {
      try {
        refetch();
      } catch (error) {
        console.error('Failed to refetch tasks after update:', error);
      }
    };

    window.addEventListener('lifeboard:tasks-updated', handleTasksUpdated);
    return () => {
      window.removeEventListener('lifeboard:tasks-updated', handleTasksUpdated);
    };
  }, [refetch]);

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

    let cursor = startOfDay(new Date(rangeStartMs));
    const rangeEndDate = startOfDay(new Date(rangeEndMs));

    while (cursor.getTime() <= rangeEndDate.getTime()) {
      const dateStr = format(cursor, 'yyyy-MM-dd');
      const lifeboardEvents = buildLifeboardEventsForDate(dateStr);
      if (lifeboardEvents.length > 0) {
        const bucket = map[dateStr] ?? (map[dateStr] = []);
        lifeboardEvents.forEach(event => {
          const taskIdKey = event.taskId ? event.taskId.toString() : undefined;
          const seenKey = taskIdKey ? `${taskIdKey}-${dateStr}` : undefined;
          if (seenKey && seenTaskInstanceKeys.has(seenKey)) {
            return;
          }
          bucket.push(event);
          if (seenKey) {
            seenTaskInstanceKeys.add(seenKey);
          }
        });
      }
      cursor = addDays(cursor, 1);
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

    setEventsByDate(map);
  }, [
    googleEvents,
    uploadedEvents,
    rangeStartMs,
    rangeEndMs,
    buildLifeboardEventsForDate,
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
    <div className="grid grid-cols-7 border-b border-[rgba(219,214,207,0.7)]">
      {weekDayLabels.map((label) => (
        <div key={label} className="py-2.5 text-center text-[11px] tracking-[0.5px] uppercase text-[#8e99a8]">
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
            container: 'border border-[#dbd6cf] bg-[#fdf8f6]/90 text-[#314158] shadow-sm hover:bg-[#fdf8f6]',
            time: 'text-[#bb9e7b]',
            dot: 'bg-[#bb9e7b]',
            badge: 'text-[#bb9e7b]'
          };
        case 'uploaded':
          return {
            container: 'border border-purple-100 bg-purple-50/90 text-purple-900 shadow-sm hover:bg-purple-50',
            time: 'text-purple-500',
            dot: 'bg-purple-400',
            badge: 'text-purple-500'
          };
        case 'lifeboard':
          return getBucketEventStyles(ev?.bucket, bucketColors);
        default:
          return {
            container: 'border border-[#dbd6cf] bg-[#faf8f5]/90 text-[#314158] shadow-sm hover:bg-[#faf8f5]',
            time: 'text-[#8e99a8]',
            dot: 'bg-[#b8b0a8]',
            badge: 'text-[#8e99a8]'
          };
      }
    },
    [bucketColors]
  );

  const showFilterControls = filterableBuckets.length > 0 || googleEvents.length > 0 || uploadedEvents.length > 0;

  return (
    <div className="w-full max-w-none mx-2 sm:mx-4 bg-white border border-[#dbd6cf] rounded-xl shadow-sm overflow-hidden">
      {/* Calidora-style Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(219,214,207,0.7)]">
        <h3 className="section-label-sm">
          {headerTitle}
        </h3>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-[#dbd6cf] overflow-hidden">
            {(['month', 'week', 'day'] as CalendarView[]).map((viewOption) => (
              <button
                type="button"
                key={viewOption}
                onClick={() => handleViewChange(viewOption)}
                aria-pressed={view === viewOption}
                className={`px-3 py-1.5 font-['DM_Sans',sans-serif] text-[11px] tracking-[0.6px] uppercase transition-colors ${
                  view === viewOption
                    ? 'bg-[#B1916A] text-white'
                    : 'text-[#596881] hover:bg-[rgba(252,250,248,0.5)]'
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
            className={`px-3 py-1.5 rounded-lg border border-[#dbd6cf] text-[12px] transition-colors ${
              isOnToday
                ? 'cursor-default text-[#c5c9d0]'
                : 'text-[#596881] hover:bg-[rgba(252,250,248,0.5)]'
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
            <svg className="h-[18px] w-[18px] text-[#596881]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={nextPeriod}
            className="p-1.5 rounded-lg hover:bg-[rgba(252,250,248,0.5)] transition-colors"
            aria-label="Next period"
          >
            <svg className="h-[18px] w-[18px] text-[#596881]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="p-1.5 rounded-lg border border-[#dbd6cf] text-[#596881] hover:bg-[rgba(252,250,248,0.5)] transition-colors"
            title="Upload calendar file"
          >
            <Upload className="h-4 w-4" />
          </button>

          {showFilterControls && (
            <div className="relative bucket-filter-dropdown">
              <button
                type="button"
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className="flex items-center gap-1 rounded-lg border border-[#dbd6cf] px-2.5 py-1.5 text-[12px] text-[#596881] hover:bg-[rgba(252,250,248,0.5)] transition-colors"
                aria-haspopup="listbox"
                aria-expanded={isFilterDropdownOpen}
              >
                <span className="truncate max-w-[100px]">{getFilterDisplayText()}</span>
                <svg className={`h-3 w-3 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isFilterDropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-[#dbd6cf] bg-white shadow-warm-lg">
                  <div className="py-1">
                    <label className="flex cursor-pointer items-center px-3 py-1.5 hover:bg-[rgba(252,250,248,0.5)]">
                      <input type="checkbox" checked={selectedBucketFilters.includes('all')} onChange={() => toggleBucketFilter('all')} className="mr-2 h-3 w-3 rounded accent-[#B1916A]" />
                      <span className="text-xs text-[#596881]">All Categories</span>
                    </label>
                    {filterableBuckets.map((bucket) => (
                      <label key={bucket} className="flex cursor-pointer items-center px-3 py-1.5 hover:bg-[rgba(252,250,248,0.5)]">
                        <input type="checkbox" checked={selectedBucketFilters.includes(bucket)} onChange={() => toggleBucketFilter(bucket)} className="mr-2 h-3 w-3 rounded accent-[#B1916A]" />
                        <span className="text-xs text-[#596881]">{bucket}</span>
                      </label>
                    ))}
                    {filterableBuckets.length > 0 && (
                      <label className="flex cursor-pointer items-center px-3 py-1.5 hover:bg-[rgba(252,250,248,0.5)]">
                        <input type="checkbox" checked={selectedBucketFilters.includes('unassigned')} onChange={() => toggleBucketFilter('unassigned')} className="mr-2 h-3 w-3 rounded accent-[#B1916A]" />
                        <span className="text-xs text-[#596881]">Unassigned</span>
                      </label>
                    )}
                    {googleEvents.length > 0 && (
                      <label className="flex cursor-pointer items-center px-3 py-1.5 hover:bg-[rgba(252,250,248,0.5)]">
                        <input type="checkbox" checked={selectedBucketFilters.includes('google')} onChange={() => toggleBucketFilter('google')} className="mr-2 h-3 w-3 rounded accent-[#B1916A]" />
                        <span className="text-xs text-[#596881]">Google Calendar</span>
                      </label>
                    )}
                    {uploadedEvents.length > 0 && (
                      <label className="flex cursor-pointer items-center px-3 py-1.5 hover:bg-[rgba(252,250,248,0.5)]">
                        <input type="checkbox" checked={selectedBucketFilters.includes('uploaded')} onChange={() => toggleBucketFilter('uploaded')} className="mr-2 h-3 w-3 rounded accent-[#B1916A]" />
                        <span className="text-xs text-[#596881]">Uploaded Calendar</span>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      {view === 'day' ? (
        // Day view: Calidora-style
        <div className="w-full">
          <div className="bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(219,214,207,0.7)]">
              <div className="flex items-center gap-3">
                <h2 className="font-['DM_Sans',sans-serif] text-[14px] tracking-[0.6px] uppercase text-[#bb9e7b]">
                  {format(currentDate, "EEEE, MMMM d, yyyy")}
                </h2>
                <StickerRow dayStr={currentDateKey} className="flex" />
              </div>
              <button
                type="button"
                onClick={() => hourlyPlannerRef.current?.openAddTaskModal()}
                className="flex items-center gap-2 rounded-lg bg-[#B1916A] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#a8896a]"
              >
                <Plus size={14} />
                <span>Add task</span>
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {importedDayEvents.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Imported Calendar</p>
                      <p className="text-sm text-amber-800/80">Events from your uploaded calendar are now visible in Day view.</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                      {importedDayEvents.length} {importedDayEvents.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>

                  {importedTimedEvents.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {importedTimedEvents.map((event, idx) => {
                        const displayTime = event.parsedTime ? format(event.parsedTime, 'h:mm a') : '';
                        return (
                          <div
                            key={`${event.eventId || event.taskId || idx}-timed-${idx}`}
                            className="flex items-start justify-between gap-3 rounded-lg border border-amber-200/80 bg-white/70 px-3 py-2 shadow-sm"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-amber-900 truncate" title={event.title}>{event.title}</p>
                              {event.location && (
                                <p className="mt-0.5 text-xs text-amber-700 truncate" title={event.location}>{event.location}</p>
                              )}
                            </div>
                            {displayTime && (
                              <span className="flex-shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                {displayTime}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {importedAllDayEvents.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">All-day</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {importedAllDayEvents.map((event, idx) => (
                          <span
                            key={`${event.eventId || event.title}-all-day-${idx}`}
                            className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-xs font-medium text-amber-800 shadow-sm"
                            title={event.title}
                          >
                            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                            <span className="truncate max-w-[160px]">{event.title}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
        <div className="relative">
          <div className="overflow-x-auto sm:overflow-visible">
            <div className={`sm:w-full ${multiDayMinWidth} sm:min-w-0`}>
              {view === 'week' ? (
                // Week view: Calidora-style columns
                <div>
                  {weekdayHeader}
                  <div className="grid grid-cols-7 min-h-[350px]">
                    {rows.flat().map((day: Date, idx: number) => {
                const dayStr = toDayKey(day);
                const dayEvents = eventsByDate[dayStr] ?? [];
                const isCurrentMonth = true; // Always show as current month in week view
                const isToday = isSameDay(day, today);
                const formattedDayLabel = format(day, 'MMMM d, yyyy');
                const weekdayLabel = format(day, 'EEE');
                
                return (
                  <Droppable key={`droppable-${dayStr}-${idx}`} droppableId={`calendar-day-${dayStr}`}>
                    {(provided, snapshot) => {
                      const dayOfWeek = day.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const cellClasses = [
                        'p-2 transition-colors relative group',
                        idx < 6 ? 'border-r border-[rgba(219,214,207,0.5)]' : '',
                        snapshot.isDraggingOver
                          ? 'bg-[rgba(177,145,106,0.08)]'
                          : isToday
                          ? 'bg-[rgba(177,145,106,0.03)]'
                          : 'bg-white',
                      ].filter(Boolean).join(' ');
                      const visibleEvents = getEventsForDisplay(dayEvents);
                      const filteredEvents = visibleEvents;
                      return (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="h-full"
                        >
                          <div
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest('.lb-day-add')) return;
                              if (dayEvents.length) setSelectedModalDate(dayStr);
                            }}
                            className={cellClasses}
                          >
                          {/* Calidora-style Day Number */}
                          <div className="flex items-center justify-between mb-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDateChange(day); handleViewChange('day'); }}
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full mt-1 text-[16px] hover:bg-[rgba(177,145,106,0.15)] transition-colors ${
                                isToday
                                  ? 'bg-[#B1916A] text-white hover:bg-[#a8896a]'
                                  : 'text-[#314158]'
                              }`}
                            >
                              {format(day, "d")}
                            </button>
                            <button
                              type="button"
                              className="lb-day-add opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[rgba(177,145,106,0.15)] text-[#8e99a8] hover:text-[#596881] transition-all"
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
                          
                          {/* Calidora-style compact event pills */}
                          <div className="flex flex-col gap-1.5">
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
                                        className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md text-left transition-colors hover:bg-[rgba(252,250,248,0.8)] cursor-grab active:cursor-grabbing ${
                                          dragSnapshot.isDragging ? 'opacity-40' : ''
                                        }`}
                                        style={styles.customColor ? { backgroundColor: styles.customColor + '12' } : {}}
                                        title={ev.title}
                                        data-task-id={ev.taskId}
                                      >
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`}
                                          style={styles.customColor ? { backgroundColor: styles.customColor } : {}}
                                        />
                                        <span className="text-[11px] text-[#314158] truncate">
                                          {ev.title}
                                        </span>
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                            {filteredEvents.length === 0 && (
                              <div className="flex items-center justify-center h-20 text-[#c5c9d0] text-[11px]" />
                            )}
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
              ) : (
                // Month view: Calidora-style grid
                <div>
                  {weekdayHeader}
                  <div className="grid auto-rows-[minmax(100px,_auto)] grid-cols-7">
              {rows.flat().map((day: Date, idx: number) => {
                const dayStr = toDayKey(day);
                const dayEvents = eventsByDate[dayStr] ?? [];
                
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, today);
                const formattedDayLabel = format(day, 'MMMM d, yyyy');
                const mobileDayLabel = format(day, 'EEE');

                return (
                  <Droppable key={`droppable-${dayStr}-${idx}`} droppableId={`calendar-day-${dayStr}`}>
                    {(provided, snapshot) => {
                      const dayOfWeek = day.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const cellClasses = [
                        'min-h-[100px] p-2 transition-colors relative group',
                        idx % 7 < 6 ? 'border-r border-[rgba(219,214,207,0.5)]' : '',
                        snapshot.isDraggingOver
                          ? 'bg-[rgba(177,145,106,0.08)]'
                          : isCurrentMonth
                          ? 'bg-white'
                          : 'bg-[rgba(252,250,248,0.3)]',
                      ].filter(Boolean).join(' ');

                      const displayEvents = getEventsForDisplay(dayEvents);
                      const filteredEvents = displayEvents;

                      return (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="h-full"
                        >
                          <div
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest('.lb-day-add')) return;
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
                                isToday ? 'bg-[#B1916A] text-white hover:bg-[#a8896a]' : 'text-[#596881] hover:bg-[rgba(177,145,106,0.15)]'
                              }`}
                            >
                              <span className="text-[12px]">{format(day, "d")}</span>
                            </button>
                            <button
                              type="button"
                              className="lb-day-add opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[rgba(177,145,106,0.15)] text-[#8e99a8] hover:text-[#596881] transition-all"
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
                                        <span className="text-[11px] text-[#314158] truncate">
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
                                className="text-[10px] text-[#8e99a8] pl-1.5 hover:text-[#596881] transition-colors text-left"
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
                className="text-[#8e99a8]/70 hover:text-[#6b7688] rounded-md focus:outline-none"
              >
                &times;
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-auto">
              {(eventsByDate[selectedModalDate || ''] ?? []).map((ev: DayEvent, idx: number) => {
                const getDotColor = (source: string, ev?: DayEvent) => {
                  switch (source) {
                    case 'google':
                      return 'bg-[#fdf8f6]0';
                    case 'uploaded':
                      return 'bg-purple-500';
                    case 'lifeboard':
                      const styles = getBucketEventStyles(ev?.bucket, bucketColors);
                      return styles.customColor || styles.dot;
                    default:
                      return 'bg-[#faf8f5]0';
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
                      <p className="text-sm font-medium text-[#314158] leading-snug">{ev.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#8e99a8]">
                        <span className="inline-flex items-center px-2 py-0.5 bg-white/60 rounded-lg font-medium">
                          {getSourceLabel(ev.source)}
                        </span>
                        {ev.time && (
                          <span className="font-medium">
                            {ev.allDay ? 'All day' : format(new Date(ev.time), 'h:mm a')}
                            {ev.duration && ev.source === 'lifeboard' && (
                              <span className="ml-1 text-[#8e99a8]/70">• {ev.duration} min</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {(eventsByDate[selectedModalDate || '']?.length ?? 0) === 0 && (
                <p className="text-sm text-[#8e99a8]">No events</p>
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
                <h3 className="text-lg font-semibold text-[#314158]">Delete Task</h3>
                <p className="text-sm text-[#6b7688] mt-1">
                  Are you sure you want to delete this task?
                </p>
              </div>
              <button 
                type="button"
                className="text-[#8e99a8]/70 hover:text-[#6b7688]" 
                onClick={() => setDeleteConfirmTask(null)}
              >
                &times;
              </button>
            </div>

            <div className="bg-[#faf8f5] rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-[#314158] truncate">
                {deleteConfirmTask.title}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm rounded border border-[#dbd6cf] text-[#4a5568] hover:bg-[#faf8f5] transition-colors"
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
