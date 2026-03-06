"use client";

import React, { useState, useEffect, useMemo } from "react";
import { format, addDays, startOfWeek, startOfDay, differenceInDays, parse } from "date-fns";
import { ChevronRight, Star, Calendar, AlertCircle } from "lucide-react";
import { Draggable } from "@hello-pangea/dnd";
import { getBucketColorSync } from "@/lib/bucket-colors";
import { normalizeBucketId } from "@/features/calendar/types";

/* ─── Bucket color helpers (shared with calendar-task-list) ─── */

const PREDEFINED_COLORS = new Set([
  "#6B8AF7", "#48B882", "#D07AA4", "#4AADE0", "#C4A44E",
  "#8B7FD4", "#E28A5D", "#5E9B8C", "#8e99a8", "#4F46E5",
  "#22C55E", "#F97316", "#EC4899", "#14B8A6", "#8B5CF6",
  "#F59E0B", "#06B6D4", "#94A3B8", "#ff52bf",
]);

export const getCustomBucketStyles = (bucketName?: string | null, bucketColors?: Record<string, string>): React.CSSProperties => {
  if (!bucketName) return {};
  const color = getBucketColorSync(normalizeBucketId(bucketName), bucketColors);
  if (PREDEFINED_COLORS.has(color)) return {};
  return { backgroundColor: color + '20', borderColor: color, color };
};

/* ─── Types ─── */

export interface EnhancedTaskCardProps {
  task: any;
  index: number;
  isExpanded: boolean;
  onToggle: (taskId: string) => void;
  onExpand: (taskId: string) => void;
  onQuickAction?: (taskId: string, action: string) => void;
  availableBuckets?: string[];
  batchUpdateTasks?: any;
  isRescheduleActive?: boolean;
  onRescheduleSelect?: (taskId: string, newDate: string | null) => void | Promise<void>;
  onRescheduleCancel?: () => void;
  bucketColors?: Record<string, string>;
  onTaskClick?: (taskId: string, dateStr: string) => void;
}

/* ─── Helpers ─── */

const getPriorityStyles = (priority?: string | number) => {
  const priorityStr = priority?.toString().toLowerCase();
  switch (priorityStr) {
    case 'critical':
    case '4': return {
      border: 'border-l-red-500 border-red-200/50',
      bg: 'bg-gradient-to-r from-red-50/80 to-white',
      icon: 'text-red-600',
      badge: 'bg-red-100 text-red-700 border-red-200'
    };
    case 'high':
    case '3': return {
      border: 'border-l-orange-500 border-orange-200/50',
      bg: 'bg-gradient-to-r from-orange-50/80 to-white',
      icon: 'text-orange-600',
      badge: 'bg-orange-100 text-orange-700 border-orange-200'
    };
    case 'medium':
    case '2': return {
      border: 'border-l-theme-secondary border-theme-neutral-300/50',
      bg: 'bg-gradient-to-r from-theme-primary-50/80 to-white',
      icon: 'text-theme-primary-600',
      badge: 'bg-theme-surface-selected text-theme-primary-600 border-theme-neutral-300'
    };
    case 'low':
    case '1': return {
      border: 'border-l-theme-neutral-400 border-theme-neutral-300/50',
      bg: 'bg-gradient-to-r from-theme-surface-alt/80 to-white',
      icon: 'text-theme-text-subtle',
      badge: 'bg-theme-brand-tint-light text-theme-text-body border-theme-neutral-300'
    };
    default: return {
      border: 'border-l-theme-neutral-300 border-theme-neutral-300/50',
      bg: 'bg-white',
      icon: 'text-theme-text-tertiary/70',
      badge: 'bg-theme-brand-tint-light text-theme-text-subtle border-theme-neutral-300'
    };
  }
};

const formatDueDate = (dueDate?: { date: string }) => {
  if (!dueDate?.date) return null;
  const date = parse(dueDate.date, 'yyyy-MM-dd', new Date());
  const today = new Date();
  const diffDays = differenceInDays(date, startOfDay(today));

  if (diffDays < 0) return { text: `${Math.abs(diffDays)} days overdue`, color: 'text-red-600', urgent: true };
  if (diffDays === 0) return { text: 'Today', color: 'text-theme-primary-600', urgent: false };
  if (diffDays === 1) return { text: 'Tomorrow', color: 'text-green-600', urgent: false };
  if (diffDays <= 7) return { text: `${diffDays} days`, color: 'text-theme-text-subtle', urgent: false };
  return { text: format(date, 'MMM d'), color: 'text-theme-text-tertiary', urgent: false };
};

/* ─── Component ─── */

export const EnhancedTaskCard = React.memo(function EnhancedTaskCard({
  task,
  index,
  isExpanded,
  onToggle,
  onExpand,
  onQuickAction,
  availableBuckets = [],
  batchUpdateTasks,
  isRescheduleActive = false,
  onRescheduleSelect,
  onRescheduleCancel,
  bucketColors = {},
  onTaskClick,
}: EnhancedTaskCardProps) {
  const dueDateInfo = formatDueDate(task.due);
  const priorityStyles = getPriorityStyles(task.priority);
  const [customRescheduleDate, setCustomRescheduleDate] = useState(task.due?.date ?? '');

  useEffect(() => {
    if (isRescheduleActive) {
      setCustomRescheduleDate(task.due?.date ?? '');
    }
  }, [isRescheduleActive, task.due?.date]);

  const quickRescheduleOptions = useMemo(() => {
    const base = task.due?.date
      ? parse(task.due.date, 'yyyy-MM-dd', new Date())
      : new Date();
    const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;
    const today = new Date();

    return [
      { label: 'Today', value: format(today, 'yyyy-MM-dd') },
      { label: 'Tomorrow', value: format(addDays(today, 1), 'yyyy-MM-dd') },
      { label: 'Next Week', value: format(addDays(safeBase, 7), 'yyyy-MM-dd') },
      { label: 'Next Monday', value: format(startOfWeek(addDays(safeBase, 7), { weekStartsOn: 1 }), 'yyyy-MM-dd') },
      { label: 'Clear due date', value: null as string | null },
    ];
  }, [task.due?.date]);

  const currentDueDate = task.due?.date ?? null;
  const rescheduleButtonClasses = `group flex items-center gap-2 px-3 py-2 text-xs font-medium transition-all duration-200 rounded-lg shadow-sm border ${isRescheduleActive
      ? 'text-theme-primary-600 bg-theme-primary-50 border-theme-neutral-300 hover:bg-theme-surface-selected hover:border-theme-neutral-400'
      : 'text-theme-text-subtle hover:text-theme-primary-600 bg-white/80 hover:bg-theme-primary-50 border-theme-neutral-300 hover:border-theme-neutral-300'
    }`;

  return (
    <Draggable draggableId={task.id.toString()} index={index} key={task.id}>
      {(provided: any) => (
        <li
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className={`group relative ${priorityStyles.bg} rounded-2xl border border-theme-neutral-300 transition-all duration-200 shadow-[0_4px_16px_rgba(163,133,96,0.06)] hover:shadow-[0_6px_20px_rgba(163,133,96,0.1)] hover:-translate-y-0.5 ${isExpanded ? 'shadow-[0_8px_30px_rgba(163,133,96,0.1)]' : ''
            } cursor-grab active:cursor-grabbing`}
        >
          {/* Task Row */}
          <div className="flex items-start gap-4 px-5 py-4">
            <label className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={task.completed ?? false}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggle(task.id.toString());
                }}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-lg border-2 transition-all duration-200 flex items-center justify-center ${task.completed
                  ? 'bg-theme-secondary border-theme-secondary scale-110'
                  : 'border-theme-neutral-300 hover:border-theme-secondary group-hover:border-theme-secondary group-hover:scale-110'
                }`}>
                {task.completed && (
                  <svg className="w-3 h-3 text-white animate-in fade-in duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </label>

            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => onTaskClick?.(task.id.toString(), task.due?.date || '')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium leading-relaxed transition-all duration-200 ${task.completed ? 'line-through text-theme-text-tertiary/70' : 'text-theme-text-primary'
                    }`}>
                    {task.content}
                  </p>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-2 mt-2">
                    {task.bucket && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-black/5 text-theme-text-body"
                        style={getCustomBucketStyles(task.bucket, bucketColors)}
                      >
                        {task.bucket}
                      </span>
                    )}

                    {task.priority && (
                      <div className="flex items-center gap-1">
                        <Star size={12} className={`transition-colors duration-200 ${priorityStyles.icon} fill-current`} />
                        <span className={`text-xs font-medium ${priorityStyles.icon}`}>
                          {task.priority?.toString().toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 text-right">
                  {dueDateInfo && (
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium ${dueDateInfo.urgent
                        ? 'bg-red-50 text-red-700'
                        : 'bg-theme-surface-alt text-theme-text-subtle'
                      }`}>
                      {dueDateInfo.urgent && <AlertCircle size={11} />}
                      <span>{dueDateInfo.text}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-lg bg-theme-brand-tint-light/80 flex items-center justify-center transition-all duration-200 ${isExpanded ? 'bg-theme-surface-selected rotate-90' : 'group-hover:bg-theme-skeleton/80'
                      }`}>
                      <ChevronRight size={12} className={`transition-colors duration-200 ${isExpanded ? 'text-theme-primary-600' : 'text-theme-text-tertiary group-hover:text-theme-text-body'
                        }`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="px-5 pb-4 border-t border-theme-neutral-300 bg-gradient-to-b from-theme-surface-alt/30 to-theme-surface-alt/60 animate-in slide-in-from-top-2 duration-300">
              {task.description && (
                <div className="mt-4 mb-4 p-3 bg-white/80 rounded-lg border border-theme-neutral-300">
                  <p className="text-sm text-theme-text-body leading-relaxed">
                    {task.description}
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickAction?.(task.id.toString(), 'reschedule');
                    }}
                    className={rescheduleButtonClasses}
                  >
                    <Calendar
                      size={14}
                      className={`transition-transform duration-200 ${isRescheduleActive ? 'text-theme-primary-600' : 'text-theme-text-tertiary group-hover:text-theme-primary-600'
                        } group-hover:scale-110`}
                    />
                    Reschedule
                  </button>

                  {availableBuckets?.length > 0 && (
                    <select
                      value={task.bucket || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        batchUpdateTasks?.([
                          { taskId: task.id.toString(), updates: { bucket: val || undefined } }
                        ]).catch((err: any) => console.error('Failed to update bucket', err));
                      }}
                      className="px-3 py-2 text-xs font-medium bg-white/80 border border-theme-neutral-300 rounded-lg hover:bg-theme-surface-alt focus:border-theme-secondary focus:ring-[3px] focus:ring-theme-focus/15 focus:outline-none transition-all duration-200 shadow-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">No project</option>
                      {availableBuckets.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  )}
                </div>

                {isRescheduleActive && (
                  <div
                    className="w-full rounded-lg border border-theme-neutral-300 bg-theme-primary-50/70 p-3 shadow-inner"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <p className="text-xs font-semibold text-theme-primary-600 mb-2">Quick reschedule</p>
                    <div className="flex flex-wrap gap-2">
                      {quickRescheduleOptions.map(({ label, value }) => {
                        const isCurrent = value === currentDueDate || (!value && !currentDueDate);
                        return (
                          <button
                            key={label}
                            type="button"
                            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors duration-200 ${isCurrent
                                ? 'bg-theme-secondary text-white border-theme-secondary shadow-sm'
                                : 'bg-white text-theme-text-subtle border-theme-neutral-300 hover:bg-theme-surface-selected hover:text-theme-primary-600'
                              }`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void onRescheduleSelect?.(task.id.toString(), value);
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <input
                        type="date"
                        value={customRescheduleDate}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setCustomRescheduleDate(event.target.value)}
                        className="rounded-lg border border-theme-neutral-300 bg-white px-2 py-1.5 text-xs text-theme-text-body focus:border-theme-secondary focus:ring-[3px] focus:ring-theme-focus/15 focus:outline-none"
                      />
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-theme-secondary text-white hover:bg-theme-primary-600 disabled:bg-theme-skeleton disabled:text-theme-text-tertiary disabled:cursor-not-allowed"
                        disabled={!customRescheduleDate}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!customRescheduleDate) return;
                          void onRescheduleSelect?.(task.id.toString(), customRescheduleDate);
                        }}
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-transparent text-theme-primary-600 hover:underline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRescheduleCancel?.();
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </li>
      )}
    </Draggable>
  );
});
