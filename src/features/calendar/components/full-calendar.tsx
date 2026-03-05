"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import {
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
  format,
} from "date-fns";

import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Upload, Clock, CalendarDays, CheckCircle2, GripVertical, MoreHorizontal } from "lucide-react";
import HourlyPlanner, { HourlyPlannerHandle } from "@/features/calendar/components/hourly-planner";
import TaskEditorModal, { TaskEditorModalHandle } from "@/features/tasks/components/task-editor-modal";
import { useTasksContext } from "@/contexts/tasks-context";
import type { RepeatOption, Task } from "@/types/tasks";
import { getBucketColorSync } from "@/lib/bucket-colors";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { useCalendarNavigation } from "@/features/calendar/hooks/use-calendar-navigation";
import { useCalendarActions } from "@/features/calendar/hooks/use-calendar-actions";
import { useCalendarDisplay, WEEKDAY_LABELS } from "@/features/calendar/hooks/use-calendar-display";
import { EventDetailsModal, DeleteConfirmModal, CalendarUploadModal } from "@/features/calendar/components/calendar-modals";
import {
  type CalendarView,
  type DayEvent,
  type FullCalendarProps,
  getRepeatLabel,
  normalizeBucketId,
  toDayKey,
  isTypingInFormField,
} from "@/features/calendar/types";
import { useCalendarStickers, MAX_STICKERS_PER_DAY } from "@/features/calendar/hooks/use-calendar-stickers";
import {
  StickerChips,
  StickerAddButtonCompact,
  StickerPalette,
  StickerRow,
} from "@/features/calendar/components/calendar-stickers";


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

export default function FullCalendar({ selectedDate: propSelectedDate, onDateChange, availableBuckets = [], selectedBucket, isDragging = false, disableInternalDragDrop = false }: FullCalendarProps = {}) {
  // Bucket colors — currently empty; getBucketColorSync has built-in fallbacks
  const bucketColors: Record<string, string> = {};
  const [selectedBucketFilters, setSelectedBucketFilters] = useState<string[]>(['all']);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const { stickersByDate, addStickerToDate, removeStickerFromDate, clearStickersForDate } = useCalendarStickers();
  const [activeStickerDay, setActiveStickerDay] = useState<string | null>(null);
  const [selectedModalDate, setSelectedModalDate] = useState<string | null>(null);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<{ id: string; title: string; date: string } | null>(null);
  const [uploadRefreshIndex, setUploadRefreshIndex] = useState(0);
  const hourlyPlannerRef = useRef<HourlyPlannerHandle | null>(null);
  const taskEditorRef = useRef<TaskEditorModalHandle | null>(null);

  // Calendar navigation: date/view state, keyboard shortcuts, period navigation
  const {
    currentDate, handleDateChange, currentDateKey, todayStr, today, isOnToday,
    view, handleViewChange, hasUserChosenMobileView,
    showKeyboardHelp, setShowKeyboardHelp, jumpDateValue, setJumpDateValue, jumpDateInputRef, jumpToDate,
    nextPeriod, prevPeriod, headerTitle,
  } = useCalendarNavigation({
    propSelectedDate,
    onDateChange,
    dismissibles: {
      activeStickerDay, setActiveStickerDay,
      isFilterDropdownOpen, setIsFilterDropdownOpen,
      selectedModalDate, setSelectedModalDate,
      deleteConfirmTask, setDeleteConfirmTask,
      isUploadModalOpen, setIsUploadModalOpen,
    },
  });

  // Get tasks from context
  const { allTasks, deleteTask, refetch, getTaskForOccurrence, createTask } = useTasksContext();

  // Calendar events pipeline: data fetching, event building, dedup
  const {
    eventsByDate,
    setEventsByDate,
    googleEvents,
    uploadedEvents,
    resolveTaskById,
    ensureTaskForEvent,
    hourSlotToISO,
    rows,
    dateRange,
  } = useCalendarEvents({
    currentDate,
    view,
    selectedBucketFilters,
    uploadRefreshIndex,
    allTasks,
    getTaskForOccurrence,
  });

  // Calendar actions: filters, stickers, event handlers, task editor helpers
  const {
    filterableBuckets, toggleBucketFilter, getFilterDisplayText,
    stickerPaletteRef, stickerTriggerRef, stickerPalettePosition, setStickerPalettePosition,
    computeStickerPalettePosition, repositionStickerPalette,
    openTaskEditor, openTaskEditorById, taskEditorDefaultDate, openCalendarEvent,
  } = useCalendarActions({
    currentDate, currentDateKey, view, availableBuckets,
    eventsByDate, setEventsByDate,
    resolveTaskById, ensureTaskForEvent, createTask, refetch,
    taskEditorRef,
    setSelectedModalDate, uploadRefreshIndex, setUploadRefreshIndex,
    selectedBucketFilters, setSelectedBucketFilters,
    isFilterDropdownOpen, setIsFilterDropdownOpen,
    activeStickerDay, setActiveStickerDay,
  });

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

  // Display computation: events, stats, mobile breakpoint, cell sizing, event styles
  const {
    selectedDateEvents, eventsInViewCount,
    importedDayEvents, importedTimedEvents, importedAllDayEvents, dayViewStats,
    isCompactBreakpoint,
    getCellSize, getMaxVisibleEvents, sortEventsForDisplay, getEventsForDisplay,
    agendaDays, multiDayMinWidth, resolveEventStyles,
  } = useCalendarDisplay({
    currentDate, currentDateKey, view, today,
    eventsByDate, rows, bucketColors,
    handleViewChange, hasUserChosenMobileView,
  });

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

  const weekdayHeader = (
    <div className="grid grid-cols-7 border-b border-theme-neutral-300/60">
      {WEEKDAY_LABELS.map((label, i) => (
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
                                {WEEKDAY_LABELS[i]}
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
        <EventDetailsModal
          selectedModalDate={selectedModalDate}
          events={eventsByDate[selectedModalDate] ?? []}
          bucketColors={bucketColors}
          onClose={() => setSelectedModalDate(null)}
        />
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
        <DeleteConfirmModal
          task={deleteConfirmTask}
          onClose={() => setDeleteConfirmTask(null)}
          onConfirm={async () => {
            try {
              await deleteTask(deleteConfirmTask.id, deleteConfirmTask.date);
              setDeleteConfirmTask(null);
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
            }
          }}
        />
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
        <CalendarUploadModal
          CalendarFileUploadComponent={CalendarFileUpload}
          onUploadComplete={async (result) => {
            if (result.success) {
              try {
                window.dispatchEvent(new CustomEvent('calendar-upload-complete'));
                setUploadRefreshIndex((prev) => prev + 1);
                try { refetch(); } catch (e) { console.error('Failed to refresh tasks after calendar upload:', e); }
              } catch (error) {
                console.error('Error refreshing calendar data:', error);
              }
              setIsUploadModalOpen(false);
            }
          }}
          onClose={() => setIsUploadModalOpen(false)}
        />
      )}

    </div>
  );
}
