"use client";

import React, { useState, useEffect } from "react";
import { isSameDay, isSameMonth, format } from "date-fns";
import { Droppable } from "@hello-pangea/dnd";
import type { DroppableProvided, DroppableStateSnapshot } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import type { DayEvent } from "@/features/calendar/types";
import { toDayKey } from "@/features/calendar/types";
import { MAX_STICKERS_PER_DAY } from "@/features/calendar/hooks/use-calendar-stickers";
import type { CalendarStickerMap } from "@/features/calendar/hooks/use-calendar-stickers";
import {
  StickerChips,
  StickerAddButtonCompact,
} from "@/features/calendar/components/calendar-stickers";
import { EventPill } from "@/features/calendar/components/calendar-mobile-components";

// ---------------------------------------------------------------------------
// LazyDroppable — only mounts the DnD Droppable when a drag is active.
// Eliminates 35-42 DnD store subscriptions in month/week view when idle.
// ---------------------------------------------------------------------------

/** Keeps Droppable mounted for a brief period after drag ends so drop
 *  animations settle before unmounting. Mounts immediately on drag start. */
function LazyDroppable({
  droppableId,
  enabled,
  direction,
  children,
}: {
  droppableId: string;
  enabled: boolean;
  direction?: "horizontal" | "vertical";
  children: (provided: DroppableProvided | null, snapshot: DroppableStateSnapshot | null) => React.ReactElement;
}) {
  // Delay unmount by 300ms so @hello-pangea/dnd drop animation completes
  const [mounted, setMounted] = useState(enabled);
  useEffect(() => {
    if (enabled) {
      setMounted(true);
    } else {
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [enabled]);

  if (!mounted) {
    return children(null, null);
  }
  return (
    <Droppable droppableId={droppableId} direction={direction}>
      {(provided, snapshot) => children(provided, snapshot)}
    </Droppable>
  );
}

// ---------------------------------------------------------------------------
// Shared callback interfaces
// ---------------------------------------------------------------------------

export interface CellCallbacks {
  handleDateChange: (date: Date) => void;
  handleViewChange: (view: "day") => void;
  setSelectedModalDate: (date: string | null) => void;
  openNewTask: (dayStr: string) => void;
  getEventsForDisplay: (events: DayEvent[]) => DayEvent[];
  resolveEventStyles: (source: DayEvent["source"], ev?: DayEvent) => { dot: string; customColor?: string };
  openCalendarEvent: (ev: DayEvent, dayStr: string) => Promise<void>;
}

export interface StickerCallbacks {
  stickersByDate: CalendarStickerMap;
  activeStickerDay: string | null;
  setActiveStickerDay: (day: string | null) => void;
  setStickerPalettePosition: (pos: { top: number; left: number } | null) => void;
  stickerTriggerRef: React.MutableRefObject<HTMLButtonElement | null>;
  removeStickerFromDate: (dateStr: string, stickerId: string) => void;
}

// ---------------------------------------------------------------------------
// Stable empty array — avoids allocations per cell
// ---------------------------------------------------------------------------

const EMPTY_EVENTS: DayEvent[] = [];

// ---------------------------------------------------------------------------
// MonthDayCell — single cell in the month grid
// ---------------------------------------------------------------------------

interface MonthDayCellProps {
  day: Date;
  idx: number;
  today: Date;
  currentDate: Date;
  isCompactBreakpoint: boolean;
  totalRows: number;
  isDragging: boolean;
  callbacks: CellCallbacks;
  stickers: StickerCallbacks;
  eventsByDate: Record<string, DayEvent[]>;
}

export const MonthDayCell = React.memo(function MonthDayCell({
  day,
  idx,
  today,
  currentDate,
  isCompactBreakpoint,
  totalRows,
  isDragging,
  callbacks,
  stickers,
  eventsByDate,
}: MonthDayCellProps) {
  const dayStr = toDayKey(day);
  const dayEvents = eventsByDate[dayStr] ?? EMPTY_EVENTS;
  const isCurrentMonth = isSameMonth(day, currentDate);
  const isToday = isSameDay(day, today);
  const isLastRow = idx >= (totalRows - 1) * 7;

  const borderClasses = [
    idx % 7 < 6 ? "border-r" : "",
    !isLastRow ? "border-b" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (isCompactBreakpoint) {
    // MOBILE: Compact cell with dots
    return (
      <LazyDroppable droppableId={`calendar-day-${dayStr}`} enabled={isDragging}>
        {(provided, snapshot) => (
          <div
            ref={provided?.innerRef}
            {...(provided?.droppableProps)}
            className={`h-full border-theme-neutral-300/50 ${borderClasses}`}
          >
            <button
              type="button"
              onClick={() => {
                callbacks.handleDateChange(day);
                callbacks.handleViewChange("day");
              }}
              className={`w-full h-full p-1 flex flex-col items-center justify-start transition-colors ${
                snapshot?.isDraggingOver
                  ? "bg-theme-brand-tint-light"
                  : isCurrentMonth
                  ? "bg-theme-surface-raised"
                  : "bg-theme-surface-warm-30"
              }`}
            >
              <span
                className={`text-xs w-7 h-7 flex items-center justify-center rounded-full ${
                  isToday
                    ? "bg-theme-primary text-white font-semibold"
                    : isCurrentMonth
                    ? "text-theme-text-secondary"
                    : "text-theme-text-quaternary"
                }`}
              >
                {format(day, "d")}
              </span>
              {isCurrentMonth && dayEvents.length > 0 && (
                <div className="flex items-center gap-[3px] mt-1">
                  {dayEvents.slice(0, 3).map((ev, i) => {
                    const dotStyles = callbacks.resolveEventStyles(ev.source, ev);
                    return (
                      <span
                        key={i}
                        className={`w-[5px] h-[5px] rounded-full ${dotStyles.dot}`}
                        style={
                          dotStyles.customColor
                            ? { backgroundColor: dotStyles.customColor }
                            : {}
                        }
                      />
                    );
                  })}
                </div>
              )}
            </button>
            {provided?.placeholder}
          </div>
        )}
      </LazyDroppable>
    );
  }

  // DESKTOP: Full cell with stickers + event pills
  // Only compute the expensive formatted label in the desktop path where it's used
  const formattedDayLabel = format(day, "MMMM d, yyyy");
  const cellClasses = [
    "p-2 transition-colors relative group h-full",
  ].join(" ");

  const displayEvents = callbacks.getEventsForDisplay(dayEvents);

  return (
    <LazyDroppable droppableId={`calendar-day-${dayStr}`} enabled={isDragging}>
      {(provided, snapshot) => {
        const bgClass = snapshot?.isDraggingOver
          ? "bg-theme-brand-tint-light"
          : isCurrentMonth
          ? "bg-theme-surface-raised"
          : "bg-theme-surface-warm-30";

        return (
          <div
            ref={provided?.innerRef}
            {...(provided?.droppableProps)}
            className={`h-full border-theme-neutral-300/50 ${borderClasses}`}
          >
            <div
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (
                  target.closest(".lb-day-add") ||
                  target.closest(".lb-sticker-add")
                )
                  return;
                if (dayEvents.length) callbacks.setSelectedModalDate(dayStr);
              }}
              className={`${cellClasses} ${bgClass}`}
            >
              {isCurrentMonth && (
                <>
                  {/* Day Number */}
                  <div className="flex items-center justify-between mb-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        callbacks.handleDateChange(day);
                        callbacks.handleViewChange("day");
                      }}
                      className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                        isToday
                          ? "bg-theme-primary text-white hover:bg-[#a8896a]"
                          : "text-theme-text-secondary hover:bg-theme-brand-tint-strong"
                      }`}
                    >
                      <span className="text-xs">{format(day, "d")}</span>
                    </button>
                    <div className="flex items-center gap-0.5">
                      <StickerAddButtonCompact
                        dayStr={dayStr}
                        stickersByDate={stickers.stickersByDate}
                        maxStickersPerDay={MAX_STICKERS_PER_DAY}
                        activeStickerDay={stickers.activeStickerDay}
                        setActiveStickerDay={stickers.setActiveStickerDay}
                        setStickerPalettePosition={stickers.setStickerPalettePosition}
                        stickerTriggerRef={stickers.stickerTriggerRef}
                      />
                      <button
                        type="button"
                        className="lb-day-add opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-theme-brand-tint-strong text-theme-text-tertiary hover:text-theme-text-secondary transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          callbacks.openNewTask(dayStr);
                        }}
                        title={`Add task on ${formattedDayLabel}`}
                        aria-label={`Add task on ${formattedDayLabel}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Sticker chips */}
                  <StickerChips
                    dayStr={dayStr}
                    stickersByDate={stickers.stickersByDate}
                    onRemove={stickers.removeStickerFromDate}
                    size="sm"
                  />

                  {/* Compact event pills */}
                  <div className="flex flex-col gap-1">
                    {displayEvents.slice(0, 3).map((ev: DayEvent, filteredIndex: number) => (
                      <EventPill
                        key={
                          ev.taskId
                            ? `lifeboard::${ev.taskId}`
                            : `event::${dayStr}::${filteredIndex}`
                        }
                        ev={ev}
                        dayStr={dayStr}
                        filteredIndex={filteredIndex}
                        styles={callbacks.resolveEventStyles(ev.source, ev)}
                        openCalendarEvent={callbacks.openCalendarEvent}
                        draggable={!!provided}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          callbacks.setSelectedModalDate(dayStr);
                        }}
                        className="text-2xs text-theme-text-tertiary pl-1.5 hover:text-theme-text-secondary transition-colors text-left"
                      >
                        +{dayEvents.length - 3} more
                      </button>
                    )}
                  </div>
                </>
              )}
              {provided?.placeholder}
            </div>
          </div>
        );
      }}
    </LazyDroppable>
  );
});

// ---------------------------------------------------------------------------
// WeekDayCell — single cell in the week grid (mobile + desktop)
// ---------------------------------------------------------------------------

interface WeekDayCellProps {
  day: Date;
  idx: number;
  today: Date;
  isMobile: boolean;
  isDragging: boolean;
  callbacks: CellCallbacks;
  stickers: StickerCallbacks;
  eventsByDate: Record<string, DayEvent[]>;
}

export const WeekDayCell = React.memo(function WeekDayCell({
  day,
  idx,
  today,
  isMobile,
  isDragging,
  callbacks,
  stickers,
  eventsByDate,
}: WeekDayCellProps) {
  const dayStr = toDayKey(day);
  const dayEvents = eventsByDate[dayStr] ?? EMPTY_EVENTS;
  const dayIsToday = isSameDay(day, today);
  const formattedDayLabel = format(day, "MMMM d, yyyy");
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
  const visibleEvents = callbacks.getEventsForDisplay(dayEvents);

  if (isMobile) {
    return (
      <LazyDroppable droppableId={`calendar-day-${dayStr}`} enabled={isDragging}>
        {(provided, snapshot) => (
          <div
            ref={provided?.innerRef}
            {...(provided?.droppableProps)}
            className={`h-full ${idx < 6 ? "border-r border-theme-neutral-300/40" : ""}`}
            style={{ scrollSnapAlign: "start" }}
          >
            <div
              className={`px-2 pt-2 pb-3 h-full ${
                snapshot?.isDraggingOver
                  ? "bg-theme-brand-tint-light"
                  : isWeekend
                  ? "bg-theme-surface-warm-60"
                  : "bg-theme-surface-raised"
              }`}
            >
              {/* Add task button — always visible on mobile */}
              <div className="flex items-center justify-end mb-2">
                <button
                  type="button"
                  className="lb-day-add p-0.5 rounded active:bg-theme-brand-tint-strong text-theme-text-tertiary transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    callbacks.openNewTask(dayStr);
                  }}
                  title={`Add task on ${formattedDayLabel}`}
                  aria-label={`Add task on ${formattedDayLabel}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Event pills */}
              <div className="flex flex-col gap-1">
                {visibleEvents.map((ev: DayEvent, filteredIndex: number) => (
                  <EventPill
                    key={
                      ev.taskId
                        ? `lifeboard::${ev.taskId}`
                        : `event::${dayStr}::${filteredIndex}`
                    }
                    ev={ev}
                    dayStr={dayStr}
                    filteredIndex={filteredIndex}
                    styles={callbacks.resolveEventStyles(ev.source, ev)}
                    openCalendarEvent={callbacks.openCalendarEvent}
                    draggable={!!provided}
                  />
                ))}
              </div>
              {provided?.placeholder}
            </div>
          </div>
        )}
      </LazyDroppable>
    );
  }

  // DESKTOP WEEK
  return (
    <LazyDroppable droppableId={`calendar-day-${dayStr}`} enabled={isDragging}>
      {(provided, snapshot) => {
        const cellClasses = [
          "px-2 pt-2 pb-3 transition-colors relative group h-full",
          snapshot?.isDraggingOver
            ? "bg-theme-brand-tint-light"
            : isWeekend
            ? "bg-theme-surface-warm-60"
            : "bg-theme-surface-raised",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            ref={provided?.innerRef}
            {...(provided?.droppableProps)}
            className={`h-full ${idx < 6 ? "border-r border-theme-neutral-300/40" : ""}`}
          >
            <div
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (
                  target.closest(".lb-day-add") ||
                  target.closest(".lb-sticker-add")
                )
                  return;
                if (dayEvents.length) callbacks.setSelectedModalDate(dayStr);
              }}
              className={cellClasses}
            >
              {/* Day Number */}
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    callbacks.handleDateChange(day);
                    callbacks.handleViewChange("day");
                  }}
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium hover:bg-theme-brand-tint-strong transition-colors ${
                    dayIsToday
                      ? "bg-theme-primary text-white hover:bg-[#a8896a]"
                      : "text-theme-text-primary"
                  }`}
                >
                  {format(day, "d")}
                </button>
                <div className="flex items-center gap-0.5">
                  <StickerAddButtonCompact
                    dayStr={dayStr}
                    stickersByDate={stickers.stickersByDate}
                    maxStickersPerDay={MAX_STICKERS_PER_DAY}
                    activeStickerDay={stickers.activeStickerDay}
                    setActiveStickerDay={stickers.setActiveStickerDay}
                    setStickerPalettePosition={stickers.setStickerPalettePosition}
                    stickerTriggerRef={stickers.stickerTriggerRef}
                  />
                  <button
                    type="button"
                    className="lb-day-add opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-theme-brand-tint-strong text-theme-text-tertiary hover:text-theme-text-secondary transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      callbacks.openNewTask(dayStr);
                    }}
                    title={`Add task on ${formattedDayLabel}`}
                    aria-label={`Add task on ${formattedDayLabel}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Sticker chips */}
              <StickerChips
                dayStr={dayStr}
                stickersByDate={stickers.stickersByDate}
                onRemove={stickers.removeStickerFromDate}
                size="md"
              />

              {/* Compact event pills */}
              <div className="flex flex-col gap-1">
                {visibleEvents.map((ev: DayEvent, filteredIndex: number) => (
                  <EventPill
                    key={
                      ev.taskId
                        ? `lifeboard::${ev.taskId}`
                        : `event::${dayStr}::${filteredIndex}`
                    }
                    ev={ev}
                    dayStr={dayStr}
                    filteredIndex={filteredIndex}
                    styles={callbacks.resolveEventStyles(ev.source, ev)}
                    openCalendarEvent={callbacks.openCalendarEvent}
                    draggable={!!provided}
                  />
                ))}
              </div>
              {provided?.placeholder}
            </div>
          </div>
        );
      }}
    </LazyDroppable>
  );
});
