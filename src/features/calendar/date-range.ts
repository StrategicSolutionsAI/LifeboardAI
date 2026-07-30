import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addDays,
  parseISO,
} from "date-fns";
import { type CalendarView, toDayKey } from "@/features/calendar/types";

/**
 * The visible range and the Google-events cache key live here rather than inside
 * the calendar hooks so the module-load prefetch in OptimizedCalendarView can
 * compute the *same* key the hook will read. When they drifted, the prefetch
 * warmed a key nothing ever looked up — one wasted Google Calendar call per visit
 * plus a cold fetch on mount.
 */

export const CALENDAR_VIEW_STORAGE_KEY = "calendar-view";
export const CALENDAR_DATE_STORAGE_KEY = "calendar-selected-date";

export interface CalendarRange {
  start: Date;
  end: Date;
}

export function calendarDateRange(view: CalendarView, currentDate: Date): CalendarRange {
  switch (view) {
    case "month":
      return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
    case "week":
      return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    case "day":
      return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
    case "agenda":
      return { start: startOfDay(currentDate), end: endOfDay(addDays(currentDate, 13)) };
    default:
      return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
  }
}

export function googleEventsCacheKey(view: CalendarView, range: CalendarRange): string {
  return `calendar-google-${view}-${toDayKey(range.start)}-${toDayKey(range.end)}`;
}

// These run at module-evaluation time for the prefetch, where a throw would take
// out the whole chunk, and localStorage access itself can throw when the browser
// blocks storage. Read defensively.
function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The view the calendar will mount with — persisted by handleViewChange. */
export function readStoredCalendarView(): CalendarView {
  const saved = readStorage(CALENDAR_VIEW_STORAGE_KEY);
  if (saved && ["month", "week", "day", "agenda"].includes(saved)) {
    return saved as CalendarView;
  }
  return "day";
}

/** The date the calendar will mount on — persisted by handleDateChange. */
export function readStoredCalendarDate(): Date {
  const saved = readStorage(CALENDAR_DATE_STORAGE_KEY);
  if (saved) {
    // parseISO returns an Invalid Date rather than throwing, so check the value.
    const parsed = parseISO(saved);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}
