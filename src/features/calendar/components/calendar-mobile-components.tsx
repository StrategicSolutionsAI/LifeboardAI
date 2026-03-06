"use client";

import React, { useState, useEffect, useRef } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Upload, MoreHorizontal } from "lucide-react";
import type { CalendarView, DayEvent } from "@/features/calendar/types";

/* ─── Mobile Sub-components ─── */

export function MobileViewDropdown({ currentView, onViewChange }: { currentView: CalendarView; onViewChange: (v: CalendarView) => void }) {
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

export function MobileOverflowMenu({
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

/* ── Memoized event pill — prevents re-renders when parent state changes ── */
export interface EventPillProps {
  ev: DayEvent;
  dayStr: string;
  filteredIndex: number;
  styles: { dot: string; customColor?: string };
  openCalendarEvent: (ev: DayEvent, dayStr: string) => Promise<void>;
}

export const EventPill = React.memo(function EventPill({ ev, dayStr, filteredIndex, styles, openCalendarEvent }: EventPillProps) {
  const hasTask = Boolean(ev.taskId);
  const canEditEvent = ev.source === 'lifeboard' || ev.source === 'uploaded' || ev.source === 'google';
  const draggableId = hasTask ? `lifeboard::${ev.taskId}` : `event::${dayStr}::${filteredIndex}`;
  return (
    <Draggable key={draggableId} draggableId={draggableId} index={filteredIndex} isDragDisabled={!hasTask}>
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
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`}
            style={styles.customColor ? { backgroundColor: styles.customColor } : {}} />
          <span className="text-[11px] leading-tight text-theme-text-primary truncate">{ev.title}</span>
        </div>
      )}
    </Draggable>
  );
});
