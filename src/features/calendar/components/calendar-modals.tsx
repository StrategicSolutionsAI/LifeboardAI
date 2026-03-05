"use client";

import { format, parseISO } from "date-fns";
import type { DayEvent } from "@/features/calendar/types";
import { getBucketEventStyles } from "@/features/calendar/types";
import type { UploadResult } from "@/features/calendar/components/calendar-file-upload";

/* ─── Event Details Modal ─── */

interface EventDetailsModalProps {
  selectedModalDate: string;
  events: DayEvent[];
  bucketColors: Record<string, string>;
  onClose: () => void;
}

export function EventDetailsModal({ selectedModalDate, events, bucketColors, onClose }: EventDetailsModalProps) {
  const getDotColor = (source: string, ev?: DayEvent) => {
    switch (source) {
      case "google":
        return "bg-theme-primary-500";
      case "uploaded":
        return "bg-purple-500";
      case "lifeboard": {
        const styles = getBucketEventStyles(ev?.bucket, bucketColors);
        return styles.customColor || styles.dot;
      }
      default:
        return "bg-theme-surface-alt0";
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "google":
        return "Google Calendar";
      case "uploaded":
        return "Uploaded Calendar";
      case "lifeboard":
        return "Hourly Schedule";
      case "todoist":
        return "Todoist";
      default:
        return source;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-96 max-w-[90%] p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Calendar event details"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">
            {format(parseISO(selectedModalDate), "MMMM d, yyyy")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-theme-text-tertiary/70 hover:text-theme-text-subtle rounded-md focus:outline-none"
            aria-label="Close event details"
          >
            &times;
          </button>
        </div>
        <div className="space-y-3 max-h-80 overflow-auto">
          {events.map((ev, idx) => {
            const modalBgColor =
              ev.source === "lifeboard" &&
              typeof getDotColor(ev.source, ev) === "string" &&
              getDotColor(ev.source, ev).startsWith("#")
                ? getDotColor(ev.source, ev) + "12"
                : "#f5f5f5";

            return (
              <div
                key={idx}
                className="flex items-start gap-3 p-4 rounded-2xl transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5"
                style={{ backgroundColor: modalBgColor, border: "none" }}
              >
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-theme-text-primary leading-snug">{ev.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-theme-text-tertiary">
                    <span className="inline-flex items-center px-2 py-0.5 bg-white/60 rounded-lg font-medium">
                      {getSourceLabel(ev.source)}
                    </span>
                    {ev.time && (
                      <span className="font-medium">
                        {ev.allDay ? "All day" : format(new Date(ev.time), "h:mm a")}
                        {ev.duration && ev.source === "lifeboard" && (
                          <span className="ml-1 text-theme-text-tertiary/70">
                            • {ev.duration} min
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
            <p className="text-sm text-theme-text-tertiary">No events</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Delete Confirm Modal ─── */

interface DeleteConfirmModalProps {
  task: { id: string; title: string; date: string };
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteConfirmModal({ task, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
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
            <h3 className="text-lg font-semibold text-theme-text-primary">Delete Task</h3>
            <p className="text-sm text-theme-text-subtle mt-1">
              Are you sure you want to delete this task?
            </p>
          </div>
          <button
            type="button"
            className="text-theme-text-tertiary/70 hover:text-theme-text-subtle"
            onClick={onClose}
            aria-label="Close delete confirmation"
          >
            &times;
          </button>
        </div>

        <div className="bg-theme-surface-alt rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-theme-text-primary truncate">{task.title}</p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm rounded border border-theme-neutral-300 text-theme-text-body hover:bg-theme-surface-alt transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
            onClick={onConfirm}
          >
            Delete Task
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Upload Calendar Modal ─── */

interface CalendarUploadModalProps {
  CalendarFileUploadComponent: React.ComponentType<{
    onUploadComplete?: (result: UploadResult) => void;
    onClose?: () => void;
  }>;
  onUploadComplete: (result: UploadResult) => void;
  onClose: () => void;
}

export function CalendarUploadModal({ CalendarFileUploadComponent, onUploadComplete, onClose }: CalendarUploadModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="max-w-4xl w-full mx-4"
        role="dialog"
        aria-modal="true"
        aria-label="Upload calendar file"
        onClick={(event) => event.stopPropagation()}
      >
        <CalendarFileUploadComponent onUploadComplete={onUploadComplete} onClose={onClose} />
      </div>
    </div>
  );
}
