import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  addMonths,
  subMonths,
  addWeeks,
  addDays,
  startOfWeek,
  endOfWeek,
  isSameDay,
  format,
  parseISO,
} from "date-fns";
import { type CalendarView, toDayKey, isTypingInFormField } from "@/features/calendar/types";

/* ─── Options ─── */

export interface UseCalendarNavigationOptions {
  /** External selected date from parent (prop-driven) */
  propSelectedDate?: Date;
  /** Callback when date changes */
  onDateChange?: (date: Date) => void;
  /** Escape-key dismissal state from other domains */
  dismissibles: {
    activeStickerDay: string | null;
    setActiveStickerDay: (v: string | null) => void;
    isFilterDropdownOpen: boolean;
    setIsFilterDropdownOpen: (v: boolean) => void;
    selectedModalDate: string | null;
    setSelectedModalDate: (v: string | null) => void;
    deleteConfirmTask: { id: string; title: string; date: string } | null;
    setDeleteConfirmTask: (v: null) => void;
    isUploadModalOpen: boolean;
    setIsUploadModalOpen: (v: boolean) => void;
  };
}

/* ─── Hook ─── */

export function useCalendarNavigation({
  propSelectedDate,
  onDateChange,
  dismissibles,
}: UseCalendarNavigationOptions) {
  // ── Date state with localStorage persistence ──
  const [currentDate, setCurrentDate] = useState(() => {
    if (propSelectedDate) return propSelectedDate;

    if (typeof window !== "undefined") {
      const savedDate = localStorage.getItem("calendar-selected-date");
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

  const handleDateChange = useCallback(
    (newDate: Date) => {
      setCurrentDate(newDate);
      if (typeof window !== "undefined") {
        localStorage.setItem("calendar-selected-date", toDayKey(newDate));
      }
      onDateChange?.(newDate);
    },
    [onDateChange],
  );

  // ── View state with localStorage persistence ──
  const [view, setView] = useState<CalendarView>(() => {
    if (typeof window !== "undefined") {
      const savedView = localStorage.getItem("calendar-view");
      if (savedView && ["month", "week", "day", "agenda"].includes(savedView)) {
        return savedView as CalendarView;
      }
    }
    return "day";
  });

  const hasUserChosenMobileView = useRef(false);

  const handleViewChange = useCallback((newView: CalendarView) => {
    hasUserChosenMobileView.current = true;
    setView(newView);
    if (typeof window !== "undefined") {
      localStorage.setItem("calendar-view", newView);
    }
  }, []);

  // ── Keyboard help & jump-to-date ──
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [jumpDateValue, setJumpDateValue] = useState(() => toDayKey(currentDate));
  const jumpDateInputRef = useRef<HTMLInputElement | null>(null);

  const jumpToDate = useCallback(() => {
    if (!jumpDateValue) return;
    const parsed = parseISO(jumpDateValue);
    if (Number.isNaN(parsed.getTime())) return;
    handleDateChange(parsed);
  }, [handleDateChange, jumpDateValue]);

  // ── Stabilized "today" ──
  const todayStr = toDayKey(new Date());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => new Date(), [todayStr]);
  const currentDateKey = useMemo(() => toDayKey(currentDate), [currentDate]);
  const isOnToday = isSameDay(currentDate, today);

  // Sync jump-date input with current date
  useEffect(() => {
    setJumpDateValue(currentDateKey);
  }, [currentDateKey]);

  // ── Header title ──
  const headerTitle = useMemo(() => {
    switch (view) {
      case "month":
        return format(currentDate, "MMMM yyyy");
      case "week": {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
      }
      case "day":
        return format(currentDate, "EEEE, MMMM d, yyyy");
      case "agenda":
        return format(currentDate, "MMMM yyyy");
      default:
        return format(currentDate, "MMMM yyyy");
    }
  }, [currentDate, view]);

  // ── Period navigation ──
  const nextPeriod = useCallback(() => {
    const newDate = (() => {
      switch (view) {
        case "month":
          return addMonths(currentDate, 1);
        case "week":
          return addWeeks(currentDate, 1);
        case "day":
          return addDays(currentDate, 1);
        case "agenda":
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
        case "month":
          return subMonths(currentDate, 1);
        case "week":
          return addWeeks(currentDate, -1);
        case "day":
          return addDays(currentDate, -1);
        case "agenda":
          return addDays(currentDate, -7);
        default:
          return currentDate;
      }
    })();
    handleDateChange(newDate);
  }, [currentDate, handleDateChange, view]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const {
      activeStickerDay,
      setActiveStickerDay,
      isFilterDropdownOpen,
      setIsFilterDropdownOpen,
      selectedModalDate,
      setSelectedModalDate,
      deleteConfirmTask,
      setDeleteConfirmTask,
      isUploadModalOpen,
      setIsUploadModalOpen,
    } = dismissibles;

    const handleCalendarShortcuts = (event: KeyboardEvent) => {
      if (isTypingInFormField(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape") {
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

      if (lower === "arrowleft") {
        event.preventDefault();
        prevPeriod();
        return;
      }

      if (lower === "arrowright") {
        event.preventDefault();
        nextPeriod();
        return;
      }

      if (lower === "t") {
        event.preventDefault();
        handleDateChange(new Date());
        return;
      }

      if (lower === "g") {
        event.preventDefault();
        jumpDateInputRef.current?.focus();
        jumpDateInputRef.current?.showPicker?.();
        return;
      }

      if (lower === "1") {
        event.preventDefault();
        handleViewChange("day");
        return;
      }

      if (lower === "2") {
        event.preventDefault();
        handleViewChange("week");
        return;
      }

      if (lower === "3") {
        event.preventDefault();
        handleViewChange("month");
        return;
      }

      if (lower === "4") {
        event.preventDefault();
        handleViewChange("agenda");
        return;
      }

      if (lower === "?") {
        event.preventDefault();
        setShowKeyboardHelp((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleCalendarShortcuts);
    return () => window.removeEventListener("keydown", handleCalendarShortcuts);
  }, [
    dismissibles,
    handleDateChange,
    handleViewChange,
    nextPeriod,
    prevPeriod,
    showKeyboardHelp,
  ]);

  return {
    // Date state
    currentDate,
    handleDateChange,
    currentDateKey,
    todayStr,
    today,
    isOnToday,

    // View state
    view,
    handleViewChange,
    hasUserChosenMobileView,

    // Keyboard help & jump-to-date
    showKeyboardHelp,
    setShowKeyboardHelp,
    jumpDateValue,
    setJumpDateValue,
    jumpDateInputRef,
    jumpToDate,

    // Navigation
    nextPeriod,
    prevPeriod,
    headerTitle,
  };
}
