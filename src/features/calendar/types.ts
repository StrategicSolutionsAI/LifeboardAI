import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
} from "date-fns";
import type { RepeatOption } from "@/types/tasks";
import { getBucketColorSync, UNASSIGNED_BUCKET_ID } from "@/lib/bucket-colors";

/* ─── Types ─── */

export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

export interface DayEvent {
  source: 'google' | 'todoist' | 'lifeboard' | 'uploaded' | 'cycle';
  title: string;
  time?: string;
  allDay?: boolean;
  taskId?: string;
  duration?: number;
  repeatRule?: RepeatOption;
  bucket?: string;
  assigneeId?: string | null;
  location?: string;
  eventId?: string;
  startDate?: string;
  endDate?: string;
  isRangeStart?: boolean;
  isRangeEnd?: boolean;
}

export interface CalendarTaskMovedDetail {
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

export interface FullCalendarProps {
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
  availableBuckets?: string[];
  selectedBucket?: string;
  isDragging?: boolean;
}

interface BucketEventStyles {
  container: string;
  time: string;
  dot: string;
  badge: string;
  customColor?: string;
}

/* ─── Constants ─── */

const REPEAT_LABELS: Record<Exclude<RepeatOption, 'none'>, string> = {
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekly: 'Every week',
  monthly: 'Every month',
};

/* ─── Pure Functions ─── */

export const getRepeatLabel = (value?: RepeatOption | null) => {
  if (!value || value === 'none') return null;
  return REPEAT_LABELS[value];
};

export const normalizeRepeatOption = (value: unknown): RepeatOption | undefined => {
  if (!value) return undefined;
  const normalized = String(value).toLowerCase();
  if (normalized === 'daily' || normalized === 'weekly' || normalized === 'weekdays' || normalized === 'monthly') {
    return normalized as RepeatOption;
  }
  return undefined;
};

export const normalizeBucketId = (name?: string | null) => {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : UNASSIGNED_BUCKET_ID;
};

export const getBucketEventStyles = (bucketName?: string | null, bucketColors?: Record<string, string>): BucketEventStyles => {
  if (!bucketName) {
    return {
      container: 'bg-emerald-50 border-l-4 border-emerald-400 text-emerald-900 hover:bg-emerald-100',
      time: 'text-emerald-600',
      dot: 'bg-emerald-400',
      badge: 'text-emerald-600'
    };
  }

  const bucketId = normalizeBucketId(bucketName);
  const color = getBucketColorSync(bucketId, bucketColors);

  const colorMap: Record<string, BucketEventStyles> = {
    "#6B8AF7": {
      container: 'bg-[#f0f3fe] border-l-4 border-[#6B8AF7] text-theme-text-primary hover:bg-[#e3e9fd]',
      time: 'text-[#5570c7]',
      dot: 'bg-[#6B8AF7]',
      badge: 'text-[#5570c7]'
    },
    "#48B882": {
      container: 'bg-[#eefaf3] border-l-4 border-[#48B882] text-theme-text-primary hover:bg-[#dcf5e7]',
      time: 'text-[#3a9468]',
      dot: 'bg-theme-success',
      badge: 'text-[#3a9468]'
    },
    "#D07AA4": {
      container: 'bg-[#fdf1f6] border-l-4 border-[#D07AA4] text-theme-text-primary hover:bg-[#fbe3ed]',
      time: 'text-[#b05c86]',
      dot: 'bg-[#D07AA4]',
      badge: 'text-[#b05c86]'
    },
    "#4AADE0": {
      container: 'bg-[#eef7fc] border-l-4 border-[#4AADE0] text-theme-text-primary hover:bg-[#dcf0fa]',
      time: 'text-[#3889b5]',
      dot: 'bg-theme-info',
      badge: 'text-[#3889b5]'
    },
    "#C4A44E": {
      container: 'bg-[#faf6ec] border-l-4 border-[#C4A44E] text-theme-text-primary hover:bg-[#f5edd8]',
      time: 'text-[#9e843e]',
      dot: 'bg-theme-warning',
      badge: 'text-[#9e843e]'
    },
    "#8B7FD4": {
      container: 'bg-[#f3f1fb] border-l-4 border-[#8B7FD4] text-theme-text-primary hover:bg-[#e7e3f7]',
      time: 'text-[#6f65aa]',
      dot: 'bg-[#8B7FD4]',
      badge: 'text-[#6f65aa]'
    },
    "#E28A5D": {
      container: 'bg-[#fdf3ee] border-l-4 border-[#E28A5D] text-theme-text-primary hover:bg-[#fbe7dc]',
      time: 'text-[#b56e4a]',
      dot: 'bg-[#E28A5D]',
      badge: 'text-[#b56e4a]'
    },
    "#5E9B8C": {
      container: 'bg-[#eff7f5] border-l-4 border-[#5E9B8C] text-theme-text-primary hover:bg-[#dff0ec]',
      time: 'text-[#4b7c70]',
      dot: 'bg-[#5E9B8C]',
      badge: 'text-[#4b7c70]'
    },
    "#8e99a8": {
      container: 'bg-theme-surface-alt border-l-4 border-theme-neutral-400 text-theme-text-primary hover:bg-theme-brand-tint-light',
      time: 'text-theme-text-subtle',
      dot: 'bg-theme-neutral-400',
      badge: 'text-theme-text-subtle'
    },
    "#4F46E5": {
      container: 'bg-theme-primary-50 border-l-4 border-theme-secondary text-theme-text-primary hover:bg-theme-surface-selected',
      time: 'text-theme-primary-600',
      dot: 'bg-theme-secondary',
      badge: 'text-theme-primary-600'
    },
    "#94A3B8": {
      container: 'bg-theme-surface-alt border-l-4 border-theme-neutral-400 text-theme-text-primary hover:bg-theme-brand-tint-light',
      time: 'text-theme-text-subtle',
      dot: 'bg-theme-neutral-400',
      badge: 'text-theme-text-subtle'
    },
    "#ff52bf": {
      container: 'bg-pink-50 border-l-4 border-pink-400 text-pink-900 hover:bg-pink-100',
      time: 'text-pink-600',
      dot: 'bg-pink-400',
      badge: 'text-pink-600'
    }
  };

  const predefinedStyle = colorMap[color];
  if (predefinedStyle) {
    return predefinedStyle;
  }

  const safeColor = color || '#B1916A';
  return {
    container: 'border-l-4 text-theme-text-primary hover:opacity-90',
    time: 'text-theme-text-subtle',
    dot: 'w-2 h-2 rounded-full',
    badge: 'text-theme-text-subtle',
    customColor: safeColor
  };
};

export const toDayKey = (date: Date) => format(date, 'yyyy-MM-dd');

export const normalizeEventTitle = (title?: string) => (
  (title ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*([@&:,;\-])\s*/g, '$1')
    .trim()
);

export const normalizeEventTimeKey = (event: DayEvent) => {
  if (event.allDay || !event.time) return 'all-day';
  const parsed = new Date(event.time);
  if (Number.isNaN(parsed.getTime())) return (event.time ?? '').toLowerCase();
  return format(parsed, 'HH:mm');
};

export const buildCrossSourceEventKey = (event: DayEvent) => {
  return `${normalizeEventTitle(event.title)}::${normalizeEventTimeKey(event)}`;
};

export const isTypingInFormField = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

/* ─── Hour-slot Utilities ─── */

/** Convert an hour-slot string (e.g. "hour-9AM", "hour-2:30PM") to an ISO timestamp for a given date. */
export const hourSlotToISO = (hourSlot: string | undefined | null, dateStr: string): string | undefined => {
  if (!hourSlot) return undefined;
  const label = hourSlot.replace(/^hour-/, '');
  const match = label.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/i);
  if (!match) return undefined;
  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  const base = new Date(`${dateStr}T00:00:00`);
  base.setHours(hour, minute, 0, 0);
  return base.toISOString();
};

/* ─── Matrix Builders ─── */

export function buildMonthMatrix(currentMonth: Date) {
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

export function buildWeekMatrix(currentDate: Date) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    week.push(addDays(weekStart, i));
  }
  return [week];
}

export function buildDayMatrix(currentDate: Date) {
  return [[currentDate]];
}
