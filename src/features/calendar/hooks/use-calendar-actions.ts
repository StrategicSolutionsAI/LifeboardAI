import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { format } from "date-fns";
import type { RepeatOption, Task } from "@/types/tasks";
import type { TaskEditorModalHandle } from "@/features/tasks/components/task-editor-modal";
import { sanitizeBucketName, isoToHourLabel } from "@/lib/task-form-utils";
import type { DayEvent, CalendarTaskMovedDetail } from "@/features/calendar/types";
import {
  computeStickerPalettePosition as computeStickerPos,
} from "@/features/calendar/components/calendar-stickers";

/* ─── Options ─── */

export interface UseCalendarActionsOptions {
  currentDate: Date;
  currentDateKey: string;
  view: string;
  availableBuckets: string[];
  // Event pipeline
  eventsByDate: Record<string, DayEvent[]>;
  setEventsByDate: React.Dispatch<React.SetStateAction<Record<string, DayEvent[]>>>;
  resolveTaskById: (taskId: string) => Task | undefined;
  ensureTaskForEvent: (eventId: string) => Promise<{ taskId?: string; bucket?: string | null; repeatRule?: string | null } | null>;
  createTask: (
    content: string,
    dueDate: string | null,
    hourSlot?: number | string | null,
    bucket?: string,
    repeat?: RepeatOption,
    options?: { endDate?: string | null; endHourSlot?: number | string | null; allDay?: boolean | null },
  ) => Promise<Task | undefined | void>;
  refetch: () => void;
  // Refs
  taskEditorRef: React.RefObject<TaskEditorModalHandle | null>;
  // State setters from main component
  setSelectedModalDate: (v: string | null) => void;
  uploadRefreshIndex: number;
  setUploadRefreshIndex: React.Dispatch<React.SetStateAction<number>>;
  // Filter state
  selectedBucketFilters: string[];
  setSelectedBucketFilters: React.Dispatch<React.SetStateAction<string[]>>;
  isFilterDropdownOpen: boolean;
  setIsFilterDropdownOpen: (v: boolean) => void;
  // Sticker palette state
  activeStickerDay: string | null;
  setActiveStickerDay: (v: string | null) => void;
}

/* ─── Hook ─── */

export function useCalendarActions({
  currentDate,
  currentDateKey,
  view,
  availableBuckets,
  eventsByDate,
  setEventsByDate,
  resolveTaskById,
  ensureTaskForEvent,
  createTask,
  refetch,
  taskEditorRef,
  setSelectedModalDate,
  uploadRefreshIndex,
  setUploadRefreshIndex,
  selectedBucketFilters,
  setSelectedBucketFilters,
  isFilterDropdownOpen,
  setIsFilterDropdownOpen,
  activeStickerDay,
  setActiveStickerDay,
}: UseCalendarActionsOptions) {
  // ── Filterable buckets ──
  const filterableBuckets = useMemo(() => {
    return Array.from(
      new Set(
        availableBuckets
          .map((bucket) => sanitizeBucketName(bucket))
          .filter((bucket): bucket is string => Boolean(bucket)),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [availableBuckets]);

  const toggleBucketFilter = useCallback((filter: string) => {
    setSelectedBucketFilters((prev) => {
      if (filter === "all") return ["all"];
      const newFilters = prev.filter((f) => f !== "all");
      if (newFilters.includes(filter)) {
        const filtered = newFilters.filter((f) => f !== filter);
        return filtered.length === 0 ? ["all"] : filtered;
      }
      return [...newFilters, filter];
    });
  }, [setSelectedBucketFilters]);

  const getFilterDisplayText = useCallback(() => {
    if (selectedBucketFilters.includes("all")) return "All Categories";
    if (selectedBucketFilters.length === 1) {
      const filter = selectedBucketFilters[0];
      if (filter.startsWith("assignee:")) return "1 person";
      return filter === "google"
        ? "Google Calendar"
        : filter === "uploaded"
          ? "Uploaded Calendar"
          : filter === "unassigned"
            ? "Unassigned"
            : filter;
    }
    return `${selectedBucketFilters.length} selected`;
  }, [selectedBucketFilters]);

  // ── Filter dropdown click-outside ──
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isFilterDropdownOpen && !target.closest(".bucket-filter-dropdown")) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterDropdownOpen, setIsFilterDropdownOpen]);

  // ── Sticker palette state & effects ──
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
  }, [computeStickerPalettePosition, setStickerPalettePosition]);

  // Close sticker palette on outside click
  useEffect(() => {
    if (!activeStickerDay) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (stickerPaletteRef.current?.contains(target)) return;
      if (stickerTriggerRef.current?.contains(target)) return;
      setActiveStickerDay(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [activeStickerDay, setActiveStickerDay]);

  // Close sticker palette on Escape
  useEffect(() => {
    if (!activeStickerDay) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveStickerDay(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeStickerDay, setActiveStickerDay]);

  // Clear sticker palette refs when closed
  useEffect(() => {
    if (!activeStickerDay) {
      stickerPaletteRef.current = null;
      stickerTriggerRef.current = null;
      setStickerPalettePosition(null);
    }
  }, [activeStickerDay, setStickerPalettePosition]);

  // Reposition on resize/scroll
  useEffect(() => {
    if (!activeStickerDay) return;
    repositionStickerPalette();
    if (typeof window === "undefined") return;
    const handleWindowChange = () => repositionStickerPalette();
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);
    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [activeStickerDay, repositionStickerPalette]);

  // Reset sticker day on view/date change
  useEffect(() => {
    setActiveStickerDay(null);
  }, [view, currentDateKey, setActiveStickerDay]);

  // ── Task editor helpers ──
  const openTaskEditor = useCallback(
    (event: DayEvent, dateStr: string) => {
      if (!event.taskId) return;
      const task = resolveTaskById(event.taskId);
      const targetDate = dateStr || task?.due?.date || format(currentDate, "yyyy-MM-dd");
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
        fallbackAssigneeId: event.assigneeId,
      });
    },
    [currentDate, resolveTaskById, setSelectedModalDate, taskEditorRef],
  );

  const openTaskEditorById = useCallback(
    (taskId: string, metadata?: { hourSlot?: string | null; plannerDate?: string | null }) => {
      setSelectedModalDate(null);
      taskEditorRef.current?.openByTaskId(taskId, metadata);
    },
    [setSelectedModalDate, taskEditorRef],
  );

  const taskEditorDefaultDate = useCallback(
    () => format(currentDate, "yyyy-MM-dd"),
    [currentDate],
  );

  // ── Open calendar event (Google/uploaded → task conversion) ──
  const openCalendarEvent = useCallback(
    async (calendarEvent: DayEvent, dateStr: string) => {
      if (calendarEvent.source === "google") {
        try {
          const hourSlot = calendarEvent.time ? isoToHourLabel(calendarEvent.time) : null;
          const hourNumber = hourSlot
            ? (() => {
                const match = hourSlot.match(/(\d{1,2})(?::(\d{2}))?(AM|PM)/i);
                if (!match) return null;
                let hours = parseInt(match[1], 10);
                const period = match[3].toUpperCase();
                if (period === "PM" && hours !== 12) hours += 12;
                if (period === "AM" && hours === 12) hours = 0;
                return hours;
              })()
            : null;

          const task = await createTask(
            calendarEvent.title,
            dateStr,
            hourNumber,
            calendarEvent.bucket || undefined,
            undefined,
            {
              allDay: calendarEvent.allDay ?? !calendarEvent.time,
              endDate: dateStr,
            },
          );

          if (task?.id) {
            await refetch();
            taskEditorRef.current?.openByTaskId(task.id.toString(), {
              plannerDate: dateStr,
              hourSlot: hourSlot || undefined,
            });
          } else {
            console.error("Task creation returned no ID");
          }
          return;
        } catch (error) {
          console.error("Failed to convert Google Calendar event to task:", error);
          if (typeof window !== "undefined") {
            window.alert("Failed to convert this Google Calendar event into an editable task. Please try again.");
          }
          return;
        }
      }

      if (calendarEvent.source !== "lifeboard" && calendarEvent.source !== "uploaded") return;

      let taskId = calendarEvent.taskId;
      let resolvedBucket = calendarEvent.bucket;
      let resolvedRepeat = calendarEvent.repeatRule;

      const needsTask = !taskId && calendarEvent.source === "uploaded" && calendarEvent.eventId;

      if (needsTask && calendarEvent.eventId) {
        const ensured = await ensureTaskForEvent(calendarEvent.eventId);
        if (ensured?.taskId) {
          taskId = ensured.taskId;
          resolvedBucket = ensured.bucket ?? resolvedBucket;
          resolvedRepeat = (ensured.repeatRule as RepeatOption | undefined) ?? resolvedRepeat;

          setEventsByDate((prev) => {
            const next = { ...prev };
            const dayEvents = next[dateStr];
            if (Array.isArray(dayEvents)) {
              next[dateStr] = dayEvents.map((event) => {
                if (event.eventId === calendarEvent.eventId) {
                  return { ...event, taskId, bucket: resolvedBucket, repeatRule: resolvedRepeat, source: "lifeboard" as const };
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
            console.error("Failed to refresh tasks after ensuring calendar task", error);
          }
        }
      }

      if (!taskId) return;

      const hydratedEvent: DayEvent = {
        ...calendarEvent,
        taskId,
        bucket: resolvedBucket ?? undefined,
        repeatRule: resolvedRepeat,
        source: "lifeboard",
      };

      openTaskEditor(hydratedEvent, dateStr);
    },
    [ensureTaskForEvent, setEventsByDate, setUploadRefreshIndex, refetch, openTaskEditor, createTask, taskEditorRef],
  );

  // ── Event move handler (custom event listener) ──
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
            source: "lifeboard",
            title: detail.title ?? "Task",
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
          const titleA = a.title ?? "";
          const titleB = b.title ?? "";
          return titleA.localeCompare(titleB);
        });
        next[detail.toDate] = destinationList;

        return next;
      });
    };

    window.addEventListener("lifeboard:calendar-task-moved", handler as EventListener);
    return () => window.removeEventListener("lifeboard:calendar-task-moved", handler as EventListener);
  }, [setEventsByDate]);

  // ── Task click listener from sidebar ──
  useEffect(() => {
    const handler = (event: CustomEvent) => {
      const { taskId, dateStr } = event.detail;
      void openTaskEditorById(taskId, { plannerDate: dateStr });
    };
    window.addEventListener("lifeboard:task-click", handler as EventListener);
    return () => window.removeEventListener("lifeboard:task-click", handler as EventListener);
  }, [openTaskEditorById]);

  return {
    // Filter
    filterableBuckets,
    toggleBucketFilter,
    getFilterDisplayText,
    // Sticker palette
    stickerPaletteRef,
    stickerTriggerRef,
    stickerPalettePosition,
    setStickerPalettePosition,
    computeStickerPalettePosition,
    repositionStickerPalette,
    // Task editor
    openTaskEditor,
    openTaskEditorById,
    taskEditorDefaultDate,
    openCalendarEvent,
  };
}

