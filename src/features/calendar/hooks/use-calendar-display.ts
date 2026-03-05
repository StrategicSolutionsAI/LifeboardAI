import { useState, useEffect, useCallback, useMemo } from "react";
import { addDays, isSameDay } from "date-fns";
import type { CalendarView, DayEvent } from "@/features/calendar/types";
import { toDayKey, getBucketEventStyles } from "@/features/calendar/types";

/* ─── Options ─── */

export interface UseCalendarDisplayOptions {
  currentDate: Date;
  currentDateKey: string;
  view: CalendarView;
  today: Date;
  eventsByDate: Record<string, DayEvent[]>;
  rows: Date[][];
  bucketColors: Record<string, string>;
  // Mobile view auto-switch
  handleViewChange: (v: CalendarView) => void;
  hasUserChosenMobileView: React.MutableRefObject<boolean>;
}

/* ─── Hook ─── */

export function useCalendarDisplay({
  currentDate,
  currentDateKey,
  view,
  today,
  eventsByDate,
  rows,
  bucketColors,
  handleViewChange,
  hasUserChosenMobileView,
}: UseCalendarDisplayOptions) {
  // ── Selected date events & derived stats ──
  const selectedDateEvents = useMemo(
    () => eventsByDate[currentDateKey] ?? [],
    [currentDateKey, eventsByDate],
  );

  const eventsInViewCount = useMemo(() => {
    const keys = new Set(rows.flat().map((date) => toDayKey(date)));
    let total = 0;
    keys.forEach((key) => {
      total += eventsByDate[key]?.length ?? 0;
    });
    return total;
  }, [eventsByDate, rows]);

  const importedDayEvents = useMemo(
    () => selectedDateEvents.filter((event) => event.source === "uploaded"),
    [selectedDateEvents],
  );

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

  const importedAllDayEvents = useMemo(
    () => importedDayEvents.filter((event) => event.allDay || !event.time),
    [importedDayEvents],
  );

  const dayViewStats = useMemo(() => {
    const events = selectedDateEvents;
    const taskCount = events.filter((e) => e.source === "lifeboard").length;
    const totalMinutes = events.reduce((sum, e) => sum + (e.duration ?? 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const plannedLabel =
      hours > 0 && mins > 0
        ? `${hours}h ${mins}m`
        : hours > 0
          ? `${hours}h`
          : mins > 0
            ? `${mins}m`
            : null;
    const allDayEvents = events.filter((e) => e.allDay && e.source === "lifeboard");
    const googleCount = events.filter((e) => e.source === "google").length;
    return { taskCount, plannedLabel, allDayEvents, googleCount };
  }, [selectedDateEvents]);

  // ── Mobile breakpoint detection ──
  const [isCompactBreakpoint, setIsCompactBreakpoint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const update = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsCompactBreakpoint(event.matches);
    };
    update(mq);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  // Auto-switch to agenda on first mobile entry only
  useEffect(() => {
    if (isCompactBreakpoint && !hasUserChosenMobileView.current && view !== "agenda") {
      handleViewChange("agenda");
      hasUserChosenMobileView.current = false;
    }
    if (!isCompactBreakpoint) {
      hasUserChosenMobileView.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompactBreakpoint]);

  // ── Cell sizing ──
  const getCellSize = useCallback(() => {
    switch (view) {
      case "month":
        return "min-h-[115px] sm:min-h-[135px]";
      case "week":
        return "min-h-[200px] sm:min-h-[360px]";
      case "day":
        return "min-h-[600px]";
      default:
        return "min-h-[115px] sm:min-h-[135px]";
    }
  }, [view]);

  // ── Event sorting & visibility ──
  const getMaxVisibleEvents = useCallback(
    (dayEvents: DayEvent[]) => {
      const baseLimit = isCompactBreakpoint ? 3 : 4;
      if (view === "week" || dayEvents.length === 0) return baseLimit;

      const hasTimeInfo = dayEvents.some((ev) => ev.time || ev.duration);
      const avgComplexity =
        dayEvents.slice(0, 10).reduce((sum, ev) => {
          let complexity = 1;
          if (ev.time) complexity += 0.3;
          if (ev.duration) complexity += 0.2;
          if (ev.repeatRule) complexity += 0.1;
          return sum + complexity;
        }, 0) / Math.min(dayEvents.length, 10);

      if (avgComplexity <= 1.15 && !hasTimeInfo) {
        return isCompactBreakpoint ? 8 : 12;
      } else if (avgComplexity <= 1.25) {
        return isCompactBreakpoint ? 6 : 9;
      } else if (avgComplexity <= 1.4) {
        return isCompactBreakpoint ? 5 : 6;
      }
      return baseLimit;
    },
    [view, isCompactBreakpoint],
  );

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
      return (a.title ?? "").localeCompare(b.title ?? "");
    });
  }, []);

  const getEventsForDisplay = useCallback(
    (dayEvents: DayEvent[]) => {
      const sortedEvents = sortEventsForDisplay(dayEvents);
      if (view === "week") return sortedEvents;
      const maxVisibleEvents = getMaxVisibleEvents(sortedEvents);
      return sortedEvents.slice(0, maxVisibleEvents);
    },
    [getMaxVisibleEvents, sortEventsForDisplay, view],
  );

  // ── Agenda view data ──
  const agendaDays = useMemo(() => {
    if (view !== "agenda") return [];
    const days: { date: Date; dateStr: string; events: DayEvent[]; isToday: boolean }[] = [];
    for (let i = 0; i < 14; i++) {
      const date = addDays(currentDate, i);
      const dateStr = toDayKey(date);
      const events = sortEventsForDisplay(eventsByDate[dateStr] ?? []);
      days.push({ date, dateStr, events, isToday: isSameDay(date, today) });
    }
    return days;
  }, [view, currentDate, eventsByDate, sortEventsForDisplay, today]);

  // ── Multi-day layout ──
  const multiDayMinWidth = isCompactBreakpoint
    ? "w-full"
    : view === "week"
      ? "w-full"
      : "min-w-[600px]";

  // ── Event style resolution ──
  const resolveEventStyles = useCallback(
    (source: DayEvent["source"], ev?: DayEvent) => {
      switch (source) {
        case "google":
          return {
            container: "border border-theme-neutral-300 bg-theme-primary-50/90 text-theme-text-primary shadow-sm hover:bg-theme-primary-50",
            time: "text-theme-secondary",
            dot: "bg-theme-secondary",
            badge: "text-theme-secondary",
          };
        case "uploaded":
          return {
            container: "border border-purple-100 bg-purple-50/90 text-purple-900 shadow-sm hover:bg-purple-50",
            time: "text-purple-500",
            dot: "bg-purple-400",
            badge: "text-purple-500",
          };
        case "cycle":
          return {
            container: "border border-pink-200 bg-pink-50/90 text-pink-900 shadow-sm hover:bg-pink-100",
            time: "text-pink-500",
            dot: "bg-pink-400",
            badge: "text-pink-600",
          };
        case "lifeboard":
          return getBucketEventStyles(ev?.bucket, bucketColors);
        default:
          return {
            container: "border border-theme-neutral-300 bg-theme-surface-alt/90 text-theme-text-primary shadow-sm hover:bg-theme-surface-alt",
            time: "text-theme-text-tertiary",
            dot: "bg-theme-neutral-400",
            badge: "text-theme-text-tertiary",
          };
      }
    },
    [bucketColors],
  );

  return {
    // Events & stats
    selectedDateEvents,
    eventsInViewCount,
    importedDayEvents,
    importedTimedEvents,
    importedAllDayEvents,
    dayViewStats,
    // Mobile
    isCompactBreakpoint,
    // Cell sizing
    getCellSize,
    // Event display
    getMaxVisibleEvents,
    sortEventsForDisplay,
    getEventsForDisplay,
    agendaDays,
    multiDayMinWidth,
    resolveEventStyles,
  };
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
