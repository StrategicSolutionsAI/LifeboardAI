"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { CSSProperties } from "react";
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
  isWithinInterval,
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
import { CalendarFileUpload } from "@/components/calendar-file-upload";
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
    backgroundClass: 'bg-indigo-50',
    textClass: 'text-indigo-500',
    ringClass: 'ring-indigo-200/70',
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
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

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
    const stickerButtonCommon = 'inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300/40';

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
            'inline-flex items-center justify-center gap-1 rounded-full border border-dashed bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-300/40',
            reachedLimit
              ? 'border-rose-200 text-rose-500 hover:border-rose-300 hover:text-rose-600'
              : 'border-gray-300 hover:border-blue-300 hover:text-blue-600'
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
            className="fixed z-[1200] max-h-[80vh] w-[208px] overflow-hidden rounded-xl border border-gray-200 bg-white/95 p-2 shadow-xl ring-1 ring-gray-100 backdrop-blur-sm"
            style={{ top: stickerPalettePosition.top, left: stickerPalettePosition.left }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <span>Choose sticker</span>
              <button
                type="button"
                className="text-gray-400 transition hover:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300/40"
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
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Select Date
                </label>
                <input
                  type="date"
                  value={selectedStickerDate || dayStr}
                  onChange={(e) => setSelectedStickerDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    className={`flex h-14 flex-col items-center justify-center gap-1 rounded-lg border border-transparent bg-gray-50 text-gray-500 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300/40 ${
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

            <div className="mt-2 space-y-1 text-[10px] text-gray-400">
              <p>{`Up to ${MAX_STICKERS_PER_DAY} stickers per day.`}</p>
              <p>Tap a sticker again to remove it.</p>
            </div>

            {dayStickers.length > 0 && (
              <button
                type="button"
                className="mt-2 w-full rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-500 transition hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-300/40"
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

    const stickerButtonCommon = 'inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300/40';

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
              'order-first inline-flex w-full items-center justify-center gap-1 rounded-full border border-dashed bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-300/40 sm:order-none sm:w-auto sm:px-3',
              reachedLimit
                ? 'border-rose-200 text-rose-500 hover:border-rose-300 hover:text-rose-600'
                : 'border-gray-300 hover:border-blue-300 hover:text-blue-600'
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
            className="fixed z-[1200] max-h-[80vh] w-[208px] overflow-hidden rounded-xl border border-gray-200 bg-white/95 p-2 shadow-xl ring-1 ring-gray-100 backdrop-blur-sm"
            style={{ top: stickerPalettePosition.top, left: stickerPalettePosition.left }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <span>Choose sticker</span>
              <button
                type="button"
                className="text-gray-400 transition hover:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300/40"
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
                    className={`flex h-14 flex-col items-center justify-center gap-1 rounded-lg border border-transparent bg-gray-50 text-gray-500 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300/40 ${
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

            <div className="mt-2 space-y-1 text-[10px] text-gray-400">
              <p>{`Up to ${MAX_STICKERS_PER_DAY} stickers per day.`}</p>
              <p>Tap a sticker again to remove it.</p>
            </div>

            {dayStickers.length > 0 && (
              <button
                type="button"
                className="mt-2 w-full rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-500 transition hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-300/40"
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
  const currentDateKey = useMemo(() => format(currentDate, 'yyyy-MM-dd'), [currentDate]);
  const [selectedModalDate, setSelectedModalDate] = useState<string | null>(null);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<{ id: string; title: string; date: string } | null>(null);
  const hourlyPlannerRef = useRef<HourlyPlannerHandle | null>(null);
  const taskEditorRef = useRef<TaskEditorModalHandle | null>(null);
  const [uploadRefreshIndex, setUploadRefreshIndex] = useState(0);

  useEffect(() => {
    setActiveStickerDay(null);
  }, [view, currentDateKey]);

  // Get tasks from context
  const { allTasks, scheduledTasks, deleteTask, refetch, getTaskForOccurrence } = useTasksContext();
  
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
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
      case 'day':
        return format(currentDate, "EEEE, MMMM d, yyyy");
      default:
        return format(currentDate, "MMMM yyyy");
    }
  };

  const rows = getMatrix();
  const importedDayEvents = useMemo(() => {
    const dayEvents = eventsByDate[currentDateKey] ?? [];
    return dayEvents.filter((event) => event.source === 'uploaded');
  }, [eventsByDate, currentDateKey]);

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

          bucket.push({
            source: resolvedTaskId ? 'lifeboard' : 'uploaded',
            title: ev.title ?? 'Uploaded Event',
            time: !eventAllDay && isRangeStart ? ev.start_time ?? undefined : undefined,
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

  const getEventsForDisplay = useCallback((dayEvents: DayEvent[]) => {
    if (view === 'week') {
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
    }

    const maxVisibleEvents = getMaxVisibleEvents(dayEvents);
    return dayEvents.slice(0, maxVisibleEvents);
  }, [view, getMaxVisibleEvents]);
  const multiDayMinWidth = isCompactBreakpoint
    ? 'w-full'
    : view === 'week'
      ? 'w-full'
      : 'min-w-[600px]';

  const weekdayHeader = (
    <div className="hidden sm:grid grid-cols-7 gap-x-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400 pb-2">
      {weekDayLabels.map((label, index) => (
        <div key={label} className="flex flex-col items-center gap-1 py-1">
          <span className="hidden text-[11px] text-gray-500 sm:block">{label}</span>
          <span className="sm:hidden text-[10px] text-gray-500">{label.slice(0, 2)}</span>
        </div>
      ))}
    </div>
  );

  const resolveEventStyles = useCallback(
    (source: DayEvent['source'], ev?: DayEvent) => {
      switch (source) {
        case 'google':
          return {
            container: 'border border-blue-100 bg-blue-50/90 text-blue-900 shadow-sm hover:bg-blue-50',
            time: 'text-blue-500',
            dot: 'bg-blue-400',
            badge: 'text-blue-500'
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
            container: 'border border-gray-100 bg-gray-50/90 text-gray-900 shadow-sm hover:bg-gray-50',
            time: 'text-gray-500',
            dot: 'bg-gray-400',
            badge: 'text-gray-500'
          };
      }
    },
    [bucketColors]
  );

  return (
    <div className="w-full max-w-none mx-2 sm:mx-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Clean Header */}
      <div className="px-3 sm:px-4 py-3 bg-gray-50/50 border-b border-gray-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <div className="flex items-center gap-2">
              <button
                onClick={prevPeriod}
                className="p-2.5 sm:p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-600 hover:text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:scale-95"
                aria-label="Previous period"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={nextPeriod}
                className="p-2.5 sm:p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-600 hover:text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:scale-95"
                aria-label="Next period"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => {
                handleDateChange(new Date());
              }}
              className="flex-1 min-w-[140px] px-4 py-2 sm:flex-none sm:min-w-0 sm:px-3 sm:py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:scale-95"
            >
              Today
            </button>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex flex-1 min-w-[140px] items-center justify-center gap-2 px-3 py-1.5 sm:flex-none sm:min-w-0 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:scale-95"
              title="Upload calendar file"
            >
              <Upload className="w-4 h-4" />
              <span className="sm:inline">Upload</span>
            </button>
          </div>

          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3 sm:justify-end">
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 sm:hidden">
                {view === 'day' ? 'Daily focus' : view === 'week' ? 'Weekly overview' : 'Monthly planner'}
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="font-semibold text-lg text-gray-900 text-left">
                  {getHeaderTitle()}
                </h2>
                {view !== 'day' && (
                  <StickerAddButton dayStr={currentDateKey} className="flex justify-start" showDatePicker={true} />
                )}
              </div>
            </div>

            {/* Multi-Select Bucket Filter */}
            {(availableBuckets.length > 0 || googleEvents.length > 0 || uploadedEvents.length > 0) && (
              <div className="flex items-center gap-2">
                <span className="hidden text-xs font-medium text-gray-600 whitespace-nowrap sm:block">Filter:</span>
                <div className="relative bucket-filter-dropdown flex-1 sm:flex-none">
                  <button
                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                    className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 flex items-center gap-1 min-w-[120px] text-left w-full"
                  >
                    <span className="truncate flex-1 text-gray-700">{getFilterDisplayText()}</span>
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
            <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200 overflow-x-auto w-full sm:w-auto">
              {(['day', 'week', 'month'] as CalendarView[]).map((viewOption) => (
                <button
                  key={viewOption}
                  onClick={() => handleViewChange(viewOption)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 text-center ${
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
      </div>

      {/* Calendar Grid */}
      {view === 'day' ? (
        // Enhanced Day view: Modern HourlyPlanner
        <div className="w-full">
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg overflow-hidden">
            <div className="px-4 py-4 sm:px-6 sm:py-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200/80">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {format(currentDate, "EEEE, MMMM d, yyyy")}
                  </h2>
                  <p className="text-sm text-gray-600 mt-2 font-medium">
                    Plan your day with precision scheduling
                  </p>
                  <StickerRow dayStr={currentDateKey} className="mt-3 flex justify-start" />
                </div>
                <button
                  type="button"
                  onClick={() => hourlyPlannerRef.current?.openAddTaskModal()}
                  className="flex w-full sm:w-auto items-center justify-center gap-2 self-start rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 active:scale-95"
                >
                  <Plus size={16} />
                  <span>Add task</span>
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 space-y-5">
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
        <div className="relative -mx-3 sm:mx-0">
          <div className="overflow-x-auto sm:overflow-visible pb-3 sm:pb-0 snap-x snap-mandatory sm:snap-none">
            <div className={`sm:w-full ${multiDayMinWidth} sm:min-w-0 px-2 sm:px-0 snap-center`}>
              {view === 'week' ? (
                // Week view: Clean, professional layout
                <div className="rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden p-2 sm:p-4 sm:min-h-[520px]">
                  {weekdayHeader}
                  <div className="grid grid-cols-1 sm:grid-cols-7 gap-y-3 sm:gap-y-2 sm:gap-x-1.5">
                    {rows.flat().map((day: Date, idx: number) => {
                const dayStr = day.toISOString().slice(0,10);
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
                            getCellSize(),
                            'relative group flex h-full flex-col items-start justify-start rounded-2xl border text-sm p-2 sm:p-3.5 transition-all duration-200 shadow-sm cursor-pointer overflow-hidden',
                        isCurrentMonth
                          ? (isWeekend
                            ? 'bg-gray-50/50 text-gray-900 border-gray-200/40'
                            : 'bg-white text-gray-900 border-gray-200/60')
                          : 'bg-gray-50 text-gray-400 border-gray-100',
                        isCurrentMonth ? 'hover:-translate-y-[1px] hover:shadow-md' : '',
                        isToday ? 'ring-2 ring-blue-500 border-blue-300 shadow-lg bg-blue-50/80' : '',
                        snapshot.isDraggingOver ? 'bg-blue-100 ring-2 ring-blue-400 shadow-lg' : ''
                      ].filter(Boolean).join(' ');
                          const dayNumberClasses = [
                            'lb-heading-sm sm:text-xl',
                            isToday ? 'text-blue-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                          ].join(' ');
                      const addButtonClasses = [
                        'lb-day-add absolute top-2 right-2 inline-flex items-center gap-1 rounded-full border border-gray-200/70 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-gray-600 shadow-sm transition',
                        // Always visible on mobile, hover on desktop
                        'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100',
                        'hover:border-blue-200 hover:text-blue-600 active:scale-95',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-white'
                      ].join(' ');
                      const visibleEvents = getEventsForDisplay(dayEvents);
                      return (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('.lb-day-add')) return;
                            if (dayEvents.length) setSelectedModalDate(dayStr);
                          }}
                          className={cellClasses}
                        >
                          {/* Clean Day Header */}
                          <div className="relative w-full pb-2 border-b border-gray-100 pr-2">
                            <div className="flex items-start justify-between gap-2 pr-12">
                              <div className="flex flex-col leading-none">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                  {weekdayLabel}
                                </span>
                                <span className={dayNumberClasses}>
                                  {format(day, "d")}
                                </span>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {dayEvents.length > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100/80 px-2 py-0.5 text-[11px] font-medium text-gray-600 shadow-inner transition group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-600">
                                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                    {dayEvents.length}
                                  </span>
                                )}
                                <StickerDisplay dayStr={dayStr} className="mt-1 flex justify-end" />
                              </div>
                            </div>
                            {/* Hover add button */}
                            <button
                              type="button"
                              className={addButtonClasses}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedModalDate(null);
                                taskEditorRef.current?.openNew(dayStr);
                              }}
                              title={`Add task on ${formattedDayLabel}`}
                              aria-label={`Add task on ${formattedDayLabel}`}
                            >
                              <Plus className="h-3 w-3" />
                              <span className="hidden sm:inline">Add</span>
                            </button>
                          </div>
                          
                          {/* Events Container */}
                          <div className="flex-1 space-y-1 overflow-visible sm:overflow-y-auto">
                            {/* No inline creation here – handled by hover modal */}
                            {visibleEvents.length > 0 ? (
                              visibleEvents.map((ev: DayEvent, i: number) => {
                                const styles = resolveEventStyles(ev.source, ev);
                                const timeDisplay = ev.time ? format(new Date(ev.time), 'h:mm a') : '';
                                const timeLabel = timeDisplay ? timeDisplay.toLowerCase() : '';
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
                                    {(dragProvided, dragSnapshot) => {
                                      const showMinimalEvent = isCompactBreakpoint;
                                      const baseDragStyle = dragProvided.draggableProps.style ?? {};
                                      const eventContainerClasses = showMinimalEvent
                                        ? 'group relative w-full px-0 py-1 text-left text-[11px] text-gray-900 transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 focus:ring-offset-0'
                                        : `group relative w-full rounded-2xl border-0 overflow-hidden backdrop-blur-sm px-3 py-2.5 text-left transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 active:scale-[0.99] ${styles.container} ${dragSnapshot.isDragging ? 'shadow-lg scale-[1.01]' : 'shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5'}`;
                                      const eventContainerStyle = showMinimalEvent
                                        ? baseDragStyle
                                        : {
                                            ...baseDragStyle,
                                            backgroundColor: styles.customColor ? styles.customColor + '12' : '#f5f5f5',
                                            border: 'none'
                                          };

                                      return (
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
                                          className={eventContainerClasses}
                                          style={eventContainerStyle as CSSProperties}
                                          title={`${ev.title}${timeDisplay ? ` at ${timeDisplay}` : ''}${ev.duration ? ` (${ev.duration}min)` : ''}`}
                                          data-task-id={ev.taskId}
                                        >
                                          {showMinimalEvent ? (
                                            <p className="truncate font-medium text-gray-900">
                                              {ev.title}
                                            </p>
                                          ) : (
                                            <div className="flex items-start gap-2">
                                              <div className="flex-1 min-w-0 space-y-0.5">
                                                <div className="flex items-center gap-1.5">
                                                  <span
                                                    className="inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                                    style={styles.customColor ? { backgroundColor: styles.customColor } : {}}
                                                  />
                                                  <p className="text-sm font-medium text-gray-900 truncate leading-tight">
                                                    {ev.title.length > 25 ? `${ev.title.substring(0, 25)}…` : ev.title}
                                                  </p>
                                                </div>
                                                {timeLabel && (
                                                  <time
                                                    dateTime={ev.time}
                                                    className="block text-[11px] font-medium tracking-wide leading-tight text-gray-500"
                                                  >
                                                    {timeLabel}
                                                  </time>
                                                )}
                                                {ev.duration && (
                                                  <p className="text-[11px] text-gray-400 font-normal">
                                                    {ev.duration} min
                                                  </p>
                                                )}
                                                {repeatLabel && (
                                                  <span className="text-emerald-600" title={repeatLabel} aria-label={repeatLabel}>
                                                    <span className="text-xs">↻</span>
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex flex-shrink-0 items-start gap-1">
                                                {!showMinimalEvent && hasTask && (
                                                  <button
                                                    type="button"
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      setDeleteConfirmTask({ id: ev.taskId!, title: ev.title, date: dayStr });
                                                    }}
                                                    className="rounded-lg p-0.5 text-gray-400 opacity-0 transition-all duration-150 hover:bg-black/5 hover:text-red-500 group-hover:opacity-100"
                                                    title="Delete task"
                                                    aria-label={`Delete ${ev.title}`}
                                                  >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }}
                                  </Draggable>
                                );
                              })
                            ) : null}
                            
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
                </div>
              ) : (
                // Month view: Clean grid layout
                <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-2 sm:p-3">
                  {weekdayHeader}
                  <div className="grid auto-rows-[minmax(135px,_1fr)] grid-cols-7 gap-x-1.5 gap-y-2 sm:gap-3">
              {rows.flat().map((day: Date, idx: number) => {
                const dayStr = day.toISOString().slice(0,10);
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
                            getCellSize(),
                            'relative group flex flex-col items-start justify-start rounded-2xl border text-sm p-2 sm:p-3 transition-all duration-200 shadow-sm cursor-pointer overflow-hidden backdrop-blur-sm',
                            isCurrentMonth
                              ? (isWeekend
                                ? 'bg-gray-50/50 text-gray-900 border-gray-200/40'
                                : 'bg-white/90 text-gray-900 border-gray-100')
                              : 'bg-gray-50 text-gray-400 border-gray-100',
                        isCurrentMonth ? 'hover:-translate-y-[1px] hover:shadow-md active:scale-[0.99] active:shadow-sm' : '',
                        isToday ? 'ring-2 ring-blue-500 border-blue-300 shadow-lg bg-blue-50/80' : '',
                        snapshot.isDraggingOver ? 'bg-blue-100 ring-2 ring-blue-400 shadow-lg' : ''
                      ].filter(Boolean).join(' ');
                      const dayNumberClasses = [
                        'text-lg sm:text-xl font-bold',
                        isToday ? 'text-blue-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                      ].join(' ');
                      const addButtonClasses = [
                        'lb-day-add absolute top-2 right-2 inline-flex items-center gap-1 rounded-full border border-gray-200/70 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-gray-600 shadow-sm transition',
                        // Always visible on mobile, hover on desktop
                        'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100',
                        'hover:border-blue-200 hover:text-blue-600 active:scale-95',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-white'
                      ].join(' ');
                      return (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('.lb-day-add')) return;
                            if (dayEvents.length) setSelectedModalDate(dayStr);
                          }}
                          className={cellClasses}
                        >
                          {/* Clean Date Header */}
                          <div className="relative w-full pr-1">
                            <div className="flex w-full items-start justify-between gap-1 sm:gap-2 pr-12">
                              <div className="flex flex-col leading-none">
                                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:hidden">
                                  {mobileDayLabel}
                                </span>
                                <span className={dayNumberClasses}>
                                  {format(day, "d")}
                                </span>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {dayEvents.length > 0 && (
                                  <span className="inline-flex items-center gap-0.5 sm:gap-1 rounded-full border border-gray-200 bg-gray-100/80 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-gray-600 shadow-inner transition group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-600">
                                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                    {dayEvents.length}
                                  </span>
                                )}
                                <StickerDisplay dayStr={dayStr} className="mt-1 flex justify-end" />
                              </div>
                            </div>
                            {/* Hover add button */}
                            <button
                              type="button"
                              className={addButtonClasses}
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setSelectedModalDate(null);
                                taskEditorRef.current?.openNew(dayStr);
                              }}
                              title={`Add task on ${formattedDayLabel}`}
                              aria-label={`Add task on ${formattedDayLabel}`}
                            >
                              <Plus className="h-3 w-3" />
                              <span className="hidden sm:inline">Add</span>
                            </button>
                          </div>
                          
                          {/* Clean Event Cards (same as week view) */}
                          {/* No inline creation here – handled by hover modal */}
                          {dayEvents.length > 0 && (
                            <div className="mt-1 w-full space-y-0.5 sm:space-y-1">
                              {getEventsForDisplay(dayEvents).map((ev: DayEvent, i: number) => {
                                const styles = resolveEventStyles(ev.source, ev);
                                const timeDisplay = ev.time ? format(new Date(ev.time), 'h:mm a') : '';
                                const timeLabel = timeDisplay ? timeDisplay.toLowerCase() : '';
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
                                    {(dragProvided, dragSnapshot) => {
                                      const showMinimalEvent = isCompactBreakpoint;
                                      const baseDragStyle = dragProvided.draggableProps.style ?? {};
                                      const eventContainerClasses = showMinimalEvent
                                        ? 'group relative w-full px-0 py-1 text-left text-[11px] text-gray-900 transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 focus:ring-offset-0'
                                        : `group relative w-full rounded-2xl border-0 overflow-hidden backdrop-blur-sm px-2.5 py-2 text-left transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 active:scale-[0.99] ${styles.container} ${dragSnapshot.isDragging ? 'shadow-lg scale-[1.01]' : 'shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5'}`;
                                      const eventContainerStyle = showMinimalEvent
                                        ? baseDragStyle
                                        : {
                                            ...baseDragStyle,
                                            backgroundColor: styles.customColor ? styles.customColor + '12' : '#f5f5f5',
                                            border: 'none'
                                          };

                                      return (
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
                                          className={eventContainerClasses}
                                          style={eventContainerStyle as CSSProperties}
                                          title={`${ev.title}${timeDisplay ? ` at ${timeDisplay}` : ''}${ev.duration ? ` (${ev.duration}min)` : ''}`}
                                        >
                                          {showMinimalEvent ? (
                                            <p className="truncate font-medium text-gray-900">
                                              {ev.title}
                                            </p>
                                          ) : (
                                            <div className="flex items-start gap-2">
                                              <div className="flex-1 min-w-0 space-y-0.5">
                                                <div className="flex items-center gap-1.5">
                                                  <span
                                                    className="inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                                    style={styles.customColor ? { backgroundColor: styles.customColor } : {}}
                                                  />
                                                  <p className="text-sm font-medium text-gray-900 truncate leading-tight">
                                                    {ev.title.length > 25 ? `${ev.title.substring(0, 25)}…` : ev.title}
                                                  </p>
                                                </div>
                                                {timeLabel && (
                                                  <time
                                                    dateTime={ev.time}
                                                    className="block text-[11px] font-medium tracking-wide leading-tight text-gray-500"
                                                  >
                                                    {timeLabel}
                                                  </time>
                                                )}
                                                {ev.duration && (
                                                  <p className="text-[11px] text-gray-400 font-normal">
                                                    {ev.duration} min
                                                  </p>
                                                )}
                                                {repeatLabel && (
                                                  <span className="text-emerald-600" title={repeatLabel} aria-label={repeatLabel}>
                                                    <span className="text-xs">↻</span>
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex flex-shrink-0 items-start gap-1">
                                                {!showMinimalEvent && hasTask && (
                                                  <button
                                                    type="button"
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      setDeleteConfirmTask({ id: ev.taskId!, title: ev.title, date: dayStr });
                                                    }}
                                                    className="rounded-lg p-0.5 text-gray-400 opacity-0 transition-all duration-150 hover:bg-black/5 hover:text-red-500 group-hover:opacity-100"
                                                    title="Delete task"
                                                    aria-label={`Delete ${ev.title}`}
                                                  >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }}
                                  </Draggable>
                                );
                              })}
                              {(() => {
                                const maxVisible = getMaxVisibleEvents(dayEvents);
                                return dayEvents.length > maxVisible && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedModalDate(dayStr);
                                    }}
                                    className="w-full rounded-lg border border-dashed border-blue-200 bg-blue-50/70 px-2 py-1.5 sm:py-1 text-[11px] font-semibold text-blue-600 transition hover:border-blue-300 hover:bg-blue-50 active:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                  >
                                    +{dayEvents.length - maxVisible} more
                                  </button>
                                );
                              })()}
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
                      <p className="text-sm font-medium text-gray-900 leading-snug">{ev.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="inline-flex items-center px-2 py-0.5 bg-white/60 rounded-lg font-medium">
                          {getSourceLabel(ev.source)}
                        </span>
                        {ev.time && (
                          <span className="font-medium">
                            {ev.allDay ? 'All day' : format(new Date(ev.time), 'h:mm a')}
                            {ev.duration && ev.source === 'lifeboard' && (
                              <span className="ml-1 text-gray-400">• {ev.duration} min</span>
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
