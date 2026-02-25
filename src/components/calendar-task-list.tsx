"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { format, isToday, isTomorrow, isThisWeek, isWithinInterval, addDays, startOfWeek, endOfWeek, addWeeks, isBefore, startOfDay, differenceInDays, parse } from "date-fns";
import { ChevronRight, ChevronDown, ChevronLeft, Clock, Star, Calendar, AlertCircle, ChevronUp, MoreHorizontal } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useTasksContext } from "@/contexts/tasks-context";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getBucketColorSync, UNASSIGNED_BUCKET_ID } from "@/lib/bucket-colors";
import { getUserPreferencesClient } from "@/lib/user-preferences";

// ---- Bucket mapping helpers ----
const UNASSIGNED_BUCKET_LABEL = "Unsorted";

const normalizeBucketId = (name?: string | null) => {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : UNASSIGNED_BUCKET_ID;
};

const getBucketColorClasses = (bucketName?: string | null, bucketColors?: Record<string, string>) => {
  if (!bucketName) return "bg-[rgba(183,148,106,0.08)] text-[#6b7688] border-[#dbd6cf]";

  const bucketId = normalizeBucketId(bucketName);
  const color = getBucketColorSync(bucketId, bucketColors);

  // Map hex colors to Tailwind classes (Calidora palette)
  const colorMap: Record<string, string> = {
    "#6B8AF7": "bg-[#f0f3fe] text-[#5570c7] border-[#c8d3f9]", // blue (Calidora)
    "#48B882": "bg-[#eefaf3] text-[#3a9468] border-[#b0e3cb]", // green (Calidora)
    "#D07AA4": "bg-[#fdf1f6] text-[#b05c86] border-[#ebc3d6]", // rose (Calidora)
    "#4AADE0": "bg-[#eef7fc] text-[#3889b5] border-[#b0daf0]", // sky blue (Calidora)
    "#C4A44E": "bg-[#faf6ec] text-[#9e843e] border-[#e0d4a8]", // golden (Calidora)
    "#8B7FD4": "bg-[#f3f1fb] text-[#6f65aa] border-[#c8c2e8]", // plum (Calidora)
    "#E28A5D": "bg-[#fdf3ee] text-[#b56e4a] border-[#f0c8b3]", // orange (Calidora)
    "#5E9B8C": "bg-[#eff7f5] text-[#4b7c70] border-[#b8d8cf]", // teal (Calidora)
    "#8e99a8": "bg-[rgba(183,148,106,0.08)] text-[#6b7688] border-[#dbd6cf]", // gray (unassigned - Calidora)
    // Legacy colors for backwards compatibility
    "#4F46E5": "bg-[#f5ede4] text-[#9a7b5a] border-[#dbd6cf]", // indigo (legacy)
    "#22C55E": "bg-[#eefaf3] text-[#3a9468] border-[#b0e3cb]", // green (legacy)
    "#F97316": "bg-orange-100 text-orange-700 border-orange-200", // orange (legacy)
    "#EC4899": "bg-pink-100 text-pink-700 border-pink-200",     // pink (legacy)
    "#14B8A6": "bg-teal-100 text-teal-700 border-teal-200",     // teal (legacy)
    "#8B5CF6": "bg-[#f3f1fb] text-[#6f65aa] border-[#c8c2e8]", // violet (legacy)
    "#F59E0B": "bg-amber-100 text-amber-700 border-amber-200",   // amber (legacy)
    "#06B6D4": "bg-cyan-100 text-cyan-700 border-cyan-200",     // cyan (legacy)
    "#94A3B8": "bg-[rgba(183,148,106,0.08)] text-[#6b7688] border-[#dbd6cf]", // gray (legacy)
    "#ff52bf": "bg-pink-100 text-pink-700 border-pink-200"      // custom pink
  };

  // Check if we have a predefined style for this color
  if (colorMap[color]) {
    return colorMap[color];
  }

  // For custom colors, return a generic class and let parent apply inline styles
  return "border border-[#dbd6cf] custom-bucket-color";
};

const getCustomBucketStyles = (bucketName?: string | null, bucketColors?: Record<string, string>) => {
  if (!bucketName) return {};

  const bucketId = normalizeBucketId(bucketName);
  const color = getBucketColorSync(bucketId, bucketColors);

  // Check if this is a custom color (not in predefined map)
  const colorMap: Record<string, string> = {
    "#6B8AF7": "predefined",
    "#48B882": "predefined",
    "#D07AA4": "predefined",
    "#4AADE0": "predefined",
    "#C4A44E": "predefined",
    "#8B7FD4": "predefined",
    "#E28A5D": "predefined",
    "#5E9B8C": "predefined",
    "#8e99a8": "predefined",
    // Legacy colors
    "#4F46E5": "predefined",
    "#22C55E": "predefined",
    "#F97316": "predefined",
    "#EC4899": "predefined",
    "#14B8A6": "predefined",
    "#8B5CF6": "predefined",
    "#F59E0B": "predefined",
    "#06B6D4": "predefined",
    "#94A3B8": "predefined",
    "#ff52bf": "predefined"
  };

  if (!colorMap[color]) {
    // This is a custom color, return inline styles
    return {
      backgroundColor: color + '20', // 20 = ~12% opacity
      borderColor: color,
      color: color
    };
  }

  return {};
};

const doesTaskOccurOnDate = (task: any, dateStr: string): boolean => {
  if (!task || task.completed) return false;
  const dueDateStr = task.due?.date;
  if (!dueDateStr) return false;

  const repeatRule = task.repeatRule;
  if (!repeatRule || repeatRule === 'none') {
    return dueDateStr === dateStr;
  }

  const target = new Date(`${dateStr}T00:00:00`);
  const due = new Date(`${dueDateStr}T00:00:00`);
  if (Number.isNaN(target.getTime()) || Number.isNaN(due.getTime())) return false;
  if (target < due) return false;

  const day = target.getDay();
  const dueDay = due.getDay();
  const diffDays = Math.floor((target.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));

  switch (repeatRule) {
    case 'daily':
      return true;
    case 'weekdays':
      return day >= 1 && day <= 5;
    case 'weekly':
      return diffDays % 7 === 0 && day === dueDay;
    case 'monthly': {
      const dueDateNum = due.getDate();
      const targetDateNum = target.getDate();
      const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      if (dueDateNum > daysInTargetMonth) {
        return targetDateNum === daysInTargetMonth;
      }
      return targetDateNum === dueDateNum;
    }
    default:
      return false;
  }
};

interface CalendarTaskListProps {
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
  availableBuckets?: string[];
  selectedBucket?: string;
  isDragging?: boolean;
  disableInternalDragDrop?: boolean;
  dashboardView?: boolean; // Simplified view for dashboard usage
  onCollapsedChange?: (collapsed: boolean) => void;
  onTaskClick?: (taskId: string, dateStr: string) => void; // Callback when a task is clicked
}

// Enhanced task card component with priority-based styling and progressive disclosure
interface EnhancedTaskCardProps {
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

function EnhancedTaskCard({
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
        border: 'border-l-[#bb9e7b] border-[#dbd6cf]/50',
        bg: 'bg-gradient-to-r from-[#fdf8f6]/80 to-white',
        icon: 'text-[#9a7b5a]',
        badge: 'bg-[#f5ede4] text-[#9a7b5a] border-[#dbd6cf]'
      };
      case 'low':
      case '1': return {
        border: 'border-l-[#b8b0a8] border-[#dbd6cf]/50',
        bg: 'bg-gradient-to-r from-[#faf8f5]/80 to-white',
        icon: 'text-[#6b7688]',
        badge: 'bg-[rgba(183,148,106,0.08)] text-[#4a5568] border-[#dbd6cf]'
      };
      default: return {
        border: 'border-l-[#dbd6cf] border-[#dbd6cf]/50',
        bg: 'bg-white',
        icon: 'text-[#8e99a8]/70',
        badge: 'bg-[rgba(183,148,106,0.08)] text-[#6b7688] border-[#dbd6cf]'
      };
    }
  };

  const formatDueDate = (dueDate?: { date: string }) => {
    if (!dueDate?.date) return null;
    // Parse date-only strings as local dates to avoid timezone shifts
    const date = parse(dueDate.date, 'yyyy-MM-dd', new Date());
    const today = new Date();
    const diffDays = differenceInDays(date, startOfDay(today));

    if (diffDays < 0) return { text: `${Math.abs(diffDays)} days overdue`, color: 'text-red-600', urgent: true };
    if (diffDays === 0) return { text: 'Today', color: 'text-[#9a7b5a]', urgent: false };
    if (diffDays === 1) return { text: 'Tomorrow', color: 'text-green-600', urgent: false };
    if (diffDays <= 7) return { text: `${diffDays} days`, color: 'text-[#6b7688]', urgent: false };
    return { text: format(date, 'MMM d'), color: 'text-[#8e99a8]', urgent: false };
  };

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
      ? 'text-[#9a7b5a] bg-[#fdf8f6] border-[#dbd6cf] hover:bg-[#f5ede4] hover:border-[#c5beb6]'
      : 'text-[#6b7688] hover:text-[#9a7b5a] bg-white/80 hover:bg-[#fdf8f6] border-[#dbd6cf] hover:border-[#dbd6cf]'
    }`;

  return (
    <Draggable draggableId={task.id.toString()} index={index} key={task.id}>
      {(provided: any) => (
        <li
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className={`group relative ${priorityStyles.bg} rounded-2xl border border-[#dbd6cf] transition-all duration-200 shadow-[0_4px_16px_rgba(163,133,96,0.06)] hover:shadow-[0_6px_20px_rgba(163,133,96,0.1)] hover:-translate-y-0.5 ${isExpanded ? 'shadow-[0_8px_30px_rgba(163,133,96,0.1)]' : ''
            } cursor-grab active:cursor-grabbing`}
        >
          {/* Premium Task Row */}
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
                  ? 'bg-[#bb9e7b] border-[#bb9e7b] scale-110'
                  : 'border-[#dbd6cf] hover:border-[#bb9e7b] group-hover:border-[#bb9e7b] group-hover:scale-110'
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
                  <p className={`text-sm font-medium leading-relaxed transition-all duration-200 ${task.completed ? 'line-through text-[#8e99a8]/70' : 'text-[#314158]'
                    }`}>
                    {task.content}
                  </p>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-2 mt-2">
                    {task.bucket && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-black/5 text-[#4a5568]"
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
                        : 'bg-[#faf8f5] text-[#6b7688]'
                      }`}>
                      {dueDateInfo.urgent && <AlertCircle size={11} />}
                      <span>{dueDateInfo.text}</span>
                    </div>
                  )}

                  {/* Expand/Collapse Indicator */}
                  <div className={`w-6 h-6 rounded-lg bg-[rgba(183,148,106,0.08)]/80 flex items-center justify-center transition-all duration-200 ${isExpanded ? 'bg-[#f5ede4] rotate-90' : 'group-hover:bg-[#ebe5de]/80'
                    }`}>
                    <ChevronRight size={12} className={`transition-colors duration-200 ${isExpanded ? 'text-[#9a7b5a]' : 'text-[#8e99a8] group-hover:text-[#4a5568]'
                      }`} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Premium Expanded Content */}
          {isExpanded && (
            <div className="px-5 pb-4 border-t border-[#dbd6cf] bg-gradient-to-b from-[#faf8f5]/30 to-[#faf8f5]/60 animate-in slide-in-from-top-2 duration-300">
              {/* Task Details */}
              {task.description && (
                <div className="mt-4 mb-4 p-3 bg-white/80 rounded-lg border border-[#dbd6cf]">
                  <p className="text-sm text-[#4a5568] leading-relaxed">
                    {task.description}
                  </p>
                </div>
              )}

              {/* Premium Action Buttons */}
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
                      className={`transition-transform duration-200 ${isRescheduleActive ? 'text-[#9a7b5a]' : 'text-[#8e99a8] group-hover:text-[#9a7b5a]'
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
                      className="px-3 py-2 text-xs font-medium bg-white/80 border border-[#dbd6cf] rounded-lg hover:bg-[#faf8f5] focus:border-[#bb9e7b] focus:ring-[3px] focus:ring-[rgba(163,133,96,0.15)] focus:outline-none transition-all duration-200 shadow-sm"
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
                    className="w-full rounded-lg border border-[#dbd6cf] bg-[#fdf8f6]/70 p-3 shadow-inner"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <p className="text-xs font-semibold text-[#9a7b5a] mb-2">Quick reschedule</p>
                    <div className="flex flex-wrap gap-2">
                      {quickRescheduleOptions.map(({ label, value }) => {
                        const isCurrent = value === currentDueDate || (!value && !currentDueDate);
                        return (
                          <button
                            key={label}
                            type="button"
                            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors duration-200 ${isCurrent
                                ? 'bg-[#bb9e7b] text-white border-[#bb9e7b] shadow-sm'
                                : 'bg-white text-[#6b7688] border-[#dbd6cf] hover:bg-[#f5ede4] hover:text-[#9a7b5a]'
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
                        className="rounded-lg border border-[#dbd6cf] bg-white px-2 py-1.5 text-xs text-[#4a5568] focus:border-[#bb9e7b] focus:ring-[3px] focus:ring-[rgba(163,133,96,0.15)] focus:outline-none"
                      />
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#bb9e7b] text-white hover:bg-[#9a7b5a] disabled:bg-[#ebe5de] disabled:text-[#8e99a8] disabled:cursor-not-allowed"
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
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-transparent text-[#9a7b5a] hover:underline"
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
}

// Smart task grouping function
function useTaskGrouping(tasks: any[]) {
  return useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);

    const groups = {
      overdue: [] as any[],
      today: [] as any[],
      tomorrow: [] as any[],
      thisWeek: [] as any[],
      nextWeek: [] as any[],
      later: [] as any[]
    };

    tasks.forEach(task => {
      if (!task.due?.date) {
        groups.later.push(task);
        return;
      }

      // Parse date-only strings as local dates to avoid timezone issues
      const taskDate = startOfDay(parse(task.due.date, 'yyyy-MM-dd', new Date()));

      if (isBefore(taskDate, today)) {
        groups.overdue.push(task);
      } else if (isToday(taskDate)) {
        groups.today.push(task);
      } else if (isTomorrow(taskDate)) {
        groups.tomorrow.push(task);
      } else if (isThisWeek(taskDate)) {
        groups.thisWeek.push(task);
      } else if (isWithinInterval(taskDate, {
        start: startOfWeek(addWeeks(now, 1)),
        end: endOfWeek(addWeeks(now, 1))
      })) {
        groups.nextWeek.push(task);
      } else {
        groups.later.push(task);
      }
    });

    return groups;
  }, [tasks]);
}

export function CalendarTaskList({ selectedDate = new Date(), availableBuckets = [], selectedBucket, disableInternalDragDrop = false, dashboardView = false, onCollapsedChange, onTaskClick }: CalendarTaskListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDailyCollapsed, setIsDailyCollapsed] = useState(false);
  const [isOpenCollapsed, setIsOpenCollapsed] = useState(false);
  const [taskView, setTaskView] = useState<'Today' | 'Upcoming' | 'Master List'>('Today');
  const [bucketColors, setBucketColors] = useState<Record<string, string>>({});

  // Use unified task context
  const {
    allTasks,
    upcomingTasks,
    loading,
    createTask,
    toggleTaskCompletion,
    batchUpdateTasks,
  } = useTasksContext();

  // Enhanced state management for upcoming tasks view
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [groupCollapsed, setGroupCollapsed] = useState<Record<string, boolean>>({
    overdue: false,
    today: true,
    tomorrow: false,
    thisWeek: true,
    nextWeek: true,
    later: true
  });
  const [rescheduleTaskId, setRescheduleTaskId] = useState<string | null>(null);

  // Filter upcoming tasks by selected bucket if provided
  const filteredUpcomingTasks = useMemo(() => {
    // Only filter by selectedBucket in dashboard view, not in Calendar view
    if (selectedBucket && dashboardView) {
      return upcomingTasks.filter(t => !t.bucket || t.bucket === selectedBucket);
    }
    return upcomingTasks;
  }, [upcomingTasks, selectedBucket, dashboardView]);

  // Group upcoming tasks intelligently
  const taskGroups = useTaskGrouping(filteredUpcomingTasks);

  useEffect(() => {
    onCollapsedChange?.(isCollapsed);
  }, [isCollapsed, onCollapsedChange]);

  useEffect(() => {
    const loadBucketColors = async () => {
      try {
        const prefs = await getUserPreferencesClient();
        if (prefs?.bucket_colors) {
          setBucketColors(prefs.bucket_colors);
        }
      } catch (error) {
        console.error("Failed to load bucket colors:", error);
      }
    };

    loadBucketColors();

    // Listen for bucket color changes
    const handleBucketColorsChanged = () => {
      loadBucketColors();
    };

    window.addEventListener('bucketColorsChanged', handleBucketColorsChanged);

    return () => {
      window.removeEventListener('bucketColorsChanged', handleBucketColorsChanged);
    };
  }, []);

  // Combined tasks for dashboard view (all incomplete tasks from the bucket, sorted by due date)
  const dashboardTasks = useMemo(() => {
    if (!dashboardView) return [];

    let allBucketTasks = allTasks.filter(t => !t.completed);

    // For dashboard view, be more strict about bucket filtering
    // Only show tasks that specifically belong to the selected bucket
    if (selectedBucket) {
      allBucketTasks = allBucketTasks.filter(t => t.bucket === selectedBucket);
    }

    // Sort tasks: those with due dates first (by date), then tasks without due dates
    return allBucketTasks.sort((a, b) => {
      // Tasks with due dates come first
      if (a.due?.date && !b.due?.date) return -1;
      if (!a.due?.date && b.due?.date) return 1;

      // Both have due dates - sort by date
      if (a.due?.date && b.due?.date) {
        const da = parse(a.due.date, 'yyyy-MM-dd', new Date()).getTime();
        const db = parse(b.due.date, 'yyyy-MM-dd', new Date()).getTime();
        return da - db;
      }

      // Both don't have due dates - maintain current order
      return 0;
    });
  }, [dashboardView, allTasks, selectedBucket]);

  // Handle task expansion
  const handleTaskExpand = useCallback((taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  }, []);

  // Handle quick actions
  const handleQuickAction = useCallback((taskId: string, action: string) => {
    if (action === 'reschedule') {
      setRescheduleTaskId((prev) => (prev === taskId ? null : taskId));
    }
  }, []);

  const handleRescheduleSelect = useCallback(async (taskId: string, newDate: string | null) => {
    try {
      await batchUpdateTasks([
        { taskId, updates: { due: newDate ? { date: newDate } : null } },
      ]);
    } catch (error) {
      console.error('Failed to reschedule task', error);
    } finally {
      setRescheduleTaskId(null);
    }
  }, [batchUpdateTasks]);

  const handleRescheduleCancel = useCallback(() => {
    setRescheduleTaskId(null);
  }, []);

  // Toggle group collapse state
  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setGroupCollapsed(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  }, []);

  // Use the selected calendar date for calendar view, real today for dashboard contexts
  const referenceDate = useMemo(() => (dashboardView ? new Date() : selectedDate), [dashboardView, selectedDate]);
  const todayStr = useMemo(() => format(referenceDate, 'yyyy-MM-dd'), [referenceDate]);
  const todayTasks = useMemo(() => {
    let filtered = allTasks.filter(t => !t.hourSlot && doesTaskOccurOnDate(t, todayStr));

    // Only filter by selectedBucket in dashboard view, not in Calendar view
    if (selectedBucket && dashboardView) {
      filtered = filtered.filter(t => !t.bucket || t.bucket === selectedBucket);
    }

    return filtered;
  }, [allTasks, todayStr, selectedBucket, dashboardView]);

  // Local order for today's tasks, persisted per-day in localStorage
  const todayOrderKey = `daily-order-${todayStr}`;

  // Force re-render trigger for today tasks
  const [todayTasksRenderKey, setTodayTasksRenderKey] = React.useState(0);

  const todayTasksOrdered = useMemo(() => {
    try {
      if (typeof window === 'undefined') return todayTasks;
      const raw = window.localStorage.getItem(todayOrderKey);
      const idOrder: string[] = raw ? JSON.parse(raw) : [];
      const map = new Map(todayTasks.map(t => [t.id.toString(), t]));
      const ordered: any[] = [];
      idOrder.forEach(id => { if (map.has(id)) { ordered.push(map.get(id)!); map.delete(id); } });
      // Append any new tasks not yet in the stored order
      ordered.push(...Array.from(map.values()));
      return ordered;
    } catch {
      return todayTasks;
    }
  }, [todayTasks, todayOrderKey]);

  // Open tasks (only shown in Master List tab)
  const openTasksBase = useMemo(() => {
    let filtered = allTasks.filter(t => !t.completed && !t.hourSlot);

    // Only filter by selectedBucket in dashboard view, not in Calendar view
    if (selectedBucket && dashboardView) {
      filtered = filtered.filter(t => !t.bucket || t.bucket === selectedBucket);
    }

    return filtered;
  }, [allTasks, selectedBucket, dashboardView]);

  // Maintain a local, immediately responsive list for open tasks
  const [openTasksLocal, setOpenTasksLocal] = useState<any[]>([]);

  // Track if we're currently reordering to prevent sync interference
  const [isReordering, setIsReordering] = React.useState(false);

  // Sync local list when membership changes (add/remove), but don't override order on mere metadata updates
  React.useEffect(() => {
    // Don't sync if we're in the middle of a reorder operation
    if (isReordering) {
      return;
    }

    const baseMap = new Map(openTasksBase.map(t => [t.id.toString(), t]));
    const localIds = new Set(openTasksLocal.map(t => t.id.toString()));

    // Check if any tasks have position values - if so, use API order
    const hasPositions = openTasksBase.some(t => t.position !== undefined);

    if (hasPositions) {
      // Use API order when tasks have positions (they're already sorted by API)
      // Only update if the order is actually different to prevent infinite loops
      const currentOrder = openTasksLocal.map(t => t.id.toString()).join(',');
      const baseOrder = openTasksBase.map(t => t.id.toString()).join(',');
      if (currentOrder !== baseOrder) {
        setOpenTasksLocal(openTasksBase);
      }
      return;
    }

    let changed = false;
    // Remove items no longer in base
    let next = openTasksLocal.filter(t => baseMap.has(t.id.toString()));
    if (next.length !== openTasksLocal.length) changed = true;
    // Append new items at the end preserving current local order
    openTasksBase.forEach(t => {
      const id = t.id.toString();
      if (!localIds.has(id)) { next.push(t); changed = true; }
    });
    if (changed || openTasksLocal.length === 0) {
      // Only update if there's an actual change to prevent infinite loops
      const nextOrder = next.map(t => t.id.toString()).join(',');
      const currentOrder = openTasksLocal.map(t => t.id.toString()).join(',');
      if (nextOrder !== currentOrder) {
        setOpenTasksLocal(next);
      }
    }
  }, [openTasksBase, openTasksLocal, isReordering]);

  // Render from local list
  const openTasksToShow = useMemo(() => {
    return openTasksLocal.length ? openTasksLocal : openTasksBase;
  }, [openTasksLocal, openTasksBase]);



  // Listen for reorder events from parent DragDropContext
  React.useEffect(() => {
    const handleReorderOpenTasks = (event: CustomEvent) => {
      const { source, destination } = event.detail;

      // Set reordering flag to prevent sync interference
      setIsReordering(true);

      const list = [...openTasksToShow];
      const [moved] = list.splice(source.index, 1);
      list.splice(destination.index, 0, moved);

      // Update local state immediately for instant UI feedback
      setOpenTasksLocal(list);

      // Persist as positions for all visible tasks
      const updates = list.map((t, idx) => ({ taskId: t.id.toString(), updates: { position: idx } }));

      batchUpdateTasks(updates)
        .then(() => {
          // Clear reordering flag after successful API call
          setTimeout(() => setIsReordering(false), 1000);
        })
        .catch(err => {
          console.error('Failed to persist order', err);
          // Clear reordering flag even on error
          setIsReordering(false);
        });
    };

    const handleReorderDailyTasks = (event: CustomEvent) => {
      const { source, destination } = event.detail;

      const list = [...todayTasksOrdered];
      const [moved] = list.splice(source.index, 1);
      list.splice(destination.index, 0, moved);

      // Force immediate re-render by updating the localStorage and triggering a state change
      if (typeof window !== 'undefined') {
        const newOrder = list.map(t => t.id.toString());
        try {
          window.localStorage.setItem(todayOrderKey, JSON.stringify(newOrder));

          // Trigger a custom event to force re-render of today tasks
          window.dispatchEvent(new CustomEvent('todayTasksReordered'));
        } catch { }
      }
    };

    const handleReorderMasterTodayTasks = (event: CustomEvent) => {
      const { source, destination } = event.detail;

      const list = [...todayTasksOrdered];
      const [moved] = list.splice(source.index, 1);
      list.splice(destination.index, 0, moved);

      // Force immediate re-render by updating the localStorage and triggering a state change
      if (typeof window !== 'undefined') {
        const newOrder = list.map(t => t.id.toString());
        try {
          window.localStorage.setItem(todayOrderKey, JSON.stringify(newOrder));

          // Trigger a custom event to force re-render of today tasks
          window.dispatchEvent(new CustomEvent('todayTasksReordered'));
        } catch { }
      }
    };

    const handleReorderUpcomingTasks = () => {
      // Upcoming tasks don't have persistent ordering like today tasks.
      // The UI handles regrouping so no additional action is required here.
    };

    const handleTodayTasksReordered = () => {
      setTodayTasksRenderKey(prev => prev + 1);
    };

    window.addEventListener('reorderOpenTasks', handleReorderOpenTasks as EventListener);
    window.addEventListener('reorderDailyTasks', handleReorderDailyTasks as EventListener);
    window.addEventListener('reorderMasterTodayTasks', handleReorderMasterTodayTasks as EventListener);
    window.addEventListener('reorderUpcomingTasks', handleReorderUpcomingTasks as EventListener);
    window.addEventListener('todayTasksReordered', handleTodayTasksReordered);

    return () => {
      window.removeEventListener('reorderOpenTasks', handleReorderOpenTasks as EventListener);
      window.removeEventListener('reorderDailyTasks', handleReorderDailyTasks as EventListener);
      window.removeEventListener('reorderMasterTodayTasks', handleReorderMasterTodayTasks as EventListener);
      window.removeEventListener('reorderUpcomingTasks', handleReorderUpcomingTasks as EventListener);
      window.removeEventListener('todayTasksReordered', handleTodayTasksReordered);
    };
  }, [openTasksToShow, todayTasksOrdered, todayOrderKey, batchUpdateTasks]);

  // New task input state
  const [newDailyTask, setNewDailyTask] = useState("");
  const [newOpenTask, setNewOpenTask] = useState("");
  const [newUpcomingTask, setNewUpcomingTask] = useState("");
  const [newUpcomingTaskDate, setNewUpcomingTaskDate] = useState("");
  const [taskBucket, setTaskBucket] = useState(selectedBucket || (availableBuckets.length > 0 ? availableBuckets[0] : ''));

  const handleAddDailyTask = async () => {
    if (newDailyTask.trim()) {
      // Always add to today in this sidebar's Today section
      await createTask(newDailyTask, todayStr, undefined, taskBucket);
      setNewDailyTask("");
    }
  };

  const handleAddOpenTask = async () => {
    if (newOpenTask.trim()) {
      await createTask(newOpenTask, null, undefined, taskBucket);
      setNewOpenTask("");
    }
  };

  const handleAddUpcomingTask = async () => {
    if (newUpcomingTask.trim() && newUpcomingTaskDate) {
      await createTask(newUpcomingTask, newUpcomingTaskDate, undefined, taskBucket);
      setNewUpcomingTask("");
      setNewUpcomingTaskDate("");
    }
  };

  // Unified drag and drop handler
  function handleDragEnd(result: DropResult) {
    // Ignore drops if a resize operation is active in the planner
    if (typeof document !== 'undefined' && document.body.classList.contains('lb-resizing')) {
      return;
    }
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // Helper functions
    const isHour = (id: string) => id.startsWith('hour-');
    const hourKey = (id: string) => id.replace('hour-', '');

    // Same list reorder - persist for specific lists
    if (source.droppableId === destination.droppableId && source.index !== destination.index) {
      // Reorder for today's list (persist to localStorage, no API call)
      if (destination.droppableId === 'dailyTasks') {
        const list = [...todayTasksOrdered];
        const [moved] = list.splice(source.index, 1);
        list.splice(destination.index, 0, moved);

        // Update localStorage immediately for instant UI feedback
        if (typeof window !== 'undefined') {
          const newOrder = list.map(t => t.id.toString());
          try {
            window.localStorage.setItem(todayOrderKey, JSON.stringify(newOrder));
            // Trigger immediate re-render
            setTodayTasksRenderKey(prev => prev + 1);
          } catch { }
        }
        return;
      }
      // Reorder for open tasks: update local order immediately and persist positions
      if (destination.droppableId === 'openTasks') {
        // Set reordering flag to prevent sync interference
        setIsReordering(true);

        const list = [...openTasksToShow];
        const [moved] = list.splice(source.index, 1);
        list.splice(destination.index, 0, moved);

        // Update local state immediately for instant UI feedback
        setOpenTasksLocal(list);

        // Persist as positions for all visible tasks
        const updates = list.map((t, idx) => ({ taskId: t.id.toString(), updates: { position: idx } }));

        batchUpdateTasks(updates)
          .then(() => {
            // Clear reordering flag after successful API call
            setTimeout(() => setIsReordering(false), 1000);
          })
          .catch(err => {
            console.error('Failed to persist order', err);
            // Clear reordering flag even on error
            setIsReordering(false);
          });
        return;
      }
    }

    // Handle moves to/from hourly planner (if calendar has hourly view)
    if (source.droppableId === 'dailyTasks' && isHour(destination.droppableId)) {
      // Daily task → Hour slot: Set the hourSlot to schedule the task
      const dstHour = hourKey(destination.droppableId);
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour }, occurrenceDate: todayStr }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }

    if (isHour(source.droppableId) && destination.droppableId === 'dailyTasks') {
      // Hour slot → Daily tasks: Remove hourSlot to unschedule
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: null as any }, occurrenceDate: todayStr }
      ]).catch(error => {
        console.error('Failed to remove task hourSlot:', error);
      });
      return;
    }

    if (isHour(source.droppableId) && isHour(destination.droppableId)) {
      // Hour slot → Different hour slot: Change hourSlot
      const dstHour = hourKey(destination.droppableId);
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour }, occurrenceDate: todayStr }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }

    // Handle moves between daily and open tasks
    if (source.droppableId === 'openTasks' && destination.droppableId === 'dailyTasks') {
      // Open task → Today list: Set due date to real today
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: { date: todayStr } } }
      ]).catch(error => {
        console.error('Failed to update task due date:', error);
      });
      return;
    }

    if (source.droppableId === 'dailyTasks' && destination.droppableId === 'openTasks') {
      // Daily task → Open: Remove due date
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: undefined } }
      ]).catch(error => {
        console.error('Failed to remove task due date:', error);
      });
      return;
    }

    // Handle moves between Master List today section and open tasks
    if (source.droppableId === 'openTasks' && destination.droppableId === 'masterTodayTasks') {
      // Open task → Master List Today: Set due date to real today
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: { date: todayStr } } }
      ]).catch(error => {
        console.error('Failed to update task due date:', error);
      });
      return;
    }

    if (source.droppableId === 'masterTodayTasks' && destination.droppableId === 'openTasks') {
      // Master List Today → Open: Remove due date
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: undefined } }
      ]).catch(error => {
        console.error('Failed to remove task due date:', error);
      });
      return;
    }

    // Handle reordering within Master List today section
    if (source.droppableId === destination.droppableId && destination.droppableId === 'masterTodayTasks') {
      const list = [...todayTasksOrdered];
      const [moved] = list.splice(source.index, 1);
      list.splice(destination.index, 0, moved);

      // Update localStorage immediately for instant UI feedback
      if (typeof window !== 'undefined') {
        const newOrder = list.map(t => t.id.toString());
        try {
          window.localStorage.setItem(todayOrderKey, JSON.stringify(newOrder));
          // Trigger immediate re-render
          setTodayTasksRenderKey(prev => prev + 1);
        } catch { }
      }
      return;
    }
  }

  if (isCollapsed) {
    return (
      <div className="w-14 bg-white/95 backdrop-blur-sm border border-[#dbd6cf] rounded-xl shadow-sm p-3">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-8 h-8 hover:bg-[rgba(183,148,106,0.08)]/80 rounded-lg transition-all duration-200 flex items-center justify-center group"
          aria-label="Expand task list"
        >
          <ChevronLeft size={18} className="text-[#8e99a8] group-hover:text-[#4a5568] transition-colors" />
        </button>
      </div>
    );
  }

  // Dashboard view: Simple task list without groupings
  if (dashboardView) {
    return (
      <div className="space-y-3">
        {loading && dashboardTasks.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="bg-[rgba(183,148,106,0.08)] h-16 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : !loading && dashboardTasks.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-xl bg-[#f5ede4] flex items-center justify-center mx-auto mb-3">
              <Clock size={20} className="text-[#9a7b5a]" />
            </div>
            <h5 className="text-sm font-medium text-[#314158] mb-1">No tasks</h5>
            <p className="text-xs text-[#8e99a8]">Add a task to get started</p>
          </div>
        ) : (
          dashboardTasks.map((task: any, index: number) => (
            <div
              key={task.id}
              className="group relative bg-white border border-[#dbd6cf] hover:border-[#dbd6cf] rounded-xl p-4 transition-all duration-200 hover:shadow-warm"
            >
              <div className="flex items-start gap-3">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={task.completed ?? false}
                    onChange={() => toggleTaskCompletion(task.id.toString())}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded-lg border-2 transition-all duration-200 flex items-center justify-center ${task.completed
                      ? 'bg-[#bb9e7b] border-[#bb9e7b]'
                      : 'border-[#dbd6cf] hover:border-[#bb9e7b] group-hover:border-[#bb9e7b]'
                    }`}>
                    {task.completed && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </label>
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onTaskClick?.(task.id.toString(), task.due?.date || todayStr)}
                >
                  <p className={`text-sm font-medium leading-relaxed transition-all duration-200 ${task.completed ? 'line-through text-[#8e99a8]/70' : 'text-[#314158]'
                    }`}>
                    {task.content}
                  </p>
                  {/* Display due date if available */}
                  {task.due?.date && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[rgba(183,148,106,0.08)] text-[#6b7688] border border-[#dbd6cf]">
                        {format(parse(task.due.date, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Add task form for dashboard view */}
        <div className="p-4 bg-gradient-to-r from-[#faf8f5]/80 to-[#faf8f5]/40 rounded-xl border border-[#dbd6cf] space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-[#bb9e7b] flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h5 className="text-sm font-medium text-[#314158]">Add task</h5>
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              placeholder="What needs to be done?"
              value={newOpenTask}
              onChange={(e) => setNewOpenTask(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newOpenTask.trim()) handleAddOpenTask(); }}
              className="flex-1 rounded-lg border border-[#dbd6cf] px-3 py-2.5 text-sm bg-white focus:border-[#bb9e7b] focus:ring-[3px] focus:ring-[rgba(163,133,96,0.15)] focus:outline-none transition-all duration-200 placeholder-[#8e99a8]/70"
            />
            <button
              onClick={handleAddOpenTask}
              disabled={!newOpenTask.trim()}
              className="px-4 py-2.5 bg-theme-primary hover:bg-theme-primary/90 disabled:bg-[#ebe5de] text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:cursor-not-allowed shadow-sm hover:shadow-warm"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full bg-white/95 backdrop-blur-sm border border-[#dbd6cf] rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#dbd6cf]/60/80 bg-gradient-to-r from-[#faf8f5]/30 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="section-label-sm">Tasks</h3>
            <p className="font-['Inter',sans-serif] text-[13px] text-[#8e99a8] mt-1">Organize your workflow</p>
          </div>
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-8 h-8 hover:bg-[rgba(183,148,106,0.08)]/80 rounded-lg transition-all duration-200 flex items-center justify-center group"
            aria-label="Collapse task list"
          >
            <ChevronRight size={18} className="text-[#8e99a8]/70 group-hover:text-[#6b7688] transition-colors" />
          </button>
        </div>
      </div>

      {/* Premium Task view toggle */}
      <div className="px-6 py-4 bg-[#faf8f5]/40">
        <div className="relative flex rounded-xl bg-white border border-[#dbd6cf] p-1 shadow-sm">
          {/* Background slider */}
          <div
            className={`absolute top-1 h-8 bg-[#bb9e7b] rounded-lg shadow-sm transition-all duration-300 ease-out`}
            style={{
              width: 'calc(33.333% - 4px)',
              transform: `translateX(${taskView === 'Today' ? '2px' : taskView === 'Upcoming' ? 'calc(100% + 2px)' : 'calc(200% + 2px)'})`
            }}
          />
          {(['Today', 'Upcoming', 'Master List'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTaskView(tab)}
              className={`relative z-10 flex-1 h-8 px-4 text-sm font-medium rounded-lg transition-all duration-300 ease-out ${taskView === tab
                  ? 'text-white'
                  : 'text-[#6b7688] hover:text-[#314158]'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Task lists with drag & drop */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full px-6 py-2 overflow-y-auto">
          {!disableInternalDragDrop ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              {renderTaskContent()}
            </DragDropContext>
          ) : (
            renderTaskContent()
          )}
        </div>
      </div>
    </div>
  );

  function renderTaskContent() {
    return (
      <>
        {taskView === 'Today' && (
          <div className="space-y-6">
            {/* Daily tasks */}
            <Droppable droppableId="dailyTasks">
              {(provided: any) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-4"
                >
                  <div
                    className="flex items-center justify-between group cursor-pointer select-none py-2"
                    onClick={() => setIsDailyCollapsed((c) => !c)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg bg-[#bb9e7b] flex items-center justify-center transition-transform duration-200 ${isDailyCollapsed ? 'rotate-0' : 'rotate-90'}`}>
                        <ChevronRight size={14} className="text-white" />
                      </div>
                      <div>
                        <h4 className="section-label">Today&apos;s Tasks</h4>
                        <p className="text-sm text-[#8e99a8]">{todayTasks.length} {todayTasks.length === 1 ? 'task' : 'tasks'}</p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`transition-all duration-300 ease-out overflow-hidden ${isDailyCollapsed ? 'max-h-0 opacity-0' : 'max-h-[400px] opacity-100'
                      }`}
                  >
                    <div className="space-y-3">
                      {loading && todayTasks.length === 0 ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse">
                              <div className="bg-[rgba(183,148,106,0.08)] h-16 rounded-xl"></div>
                            </div>
                          ))}
                        </div>
                      ) : !loading && todayTasks.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="w-12 h-12 rounded-xl bg-[#f5ede4] flex items-center justify-center mx-auto mb-3">
                            <Clock size={20} className="text-[#9a7b5a]" />
                          </div>
                          <h5 className="text-sm font-medium text-[#314158] mb-1">No tasks for today</h5>
                          <p className="text-xs text-[#8e99a8]">Add a task to get started</p>
                        </div>
                      ) : (
                        todayTasksOrdered.map((t: any, index: number) => (
                          <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                            {(provided: any) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={provided.draggableProps.style}
                                className="group relative bg-white border border-[#dbd6cf] hover:border-[#dbd6cf] rounded-xl p-4 transition-all duration-200 hover:shadow-warm cursor-grab active:cursor-grabbing"
                              >
                                <div className="flex items-start gap-3">
                                  <label className="flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={t.completed ?? false}
                                      onChange={() => toggleTaskCompletion(t.id.toString())}
                                      className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded-lg border-2 transition-all duration-200 flex items-center justify-center ${t.completed
                                        ? 'bg-[#bb9e7b] border-[#bb9e7b]'
                                        : 'border-[#dbd6cf] hover:border-[#bb9e7b] group-hover:border-[#bb9e7b]'
                                      }`}>
                                      {t.completed && (
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                  </label>
                                  <div
                                    className="flex-1 min-w-0 cursor-pointer"
                                    onClick={() => onTaskClick?.(t.id.toString(), todayStr)}
                                  >
                                    <p className={`text-sm font-medium leading-relaxed transition-all duration-200 ${t.completed ? 'line-through text-[#8e99a8]/70' : 'text-[#314158]'
                                      }`}>
                                      {t.content}
                                    </p>
                                    {t.bucket && (
                                      <div className="mt-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBucketColorClasses(t.bucket, bucketColors)}`}
                                          style={getCustomBucketStyles(t.bucket, bucketColors)}
                                        >
                                          {t.bucket}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {/* Hover bucket selector for Today tasks */}
                                {availableBuckets?.length > 0 && (
                                  <select
                                    aria-label="Change bucket"
                                    title="Change bucket"
                                    value={t.bucket || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      batchUpdateTasks([
                                        { taskId: t.id.toString(), updates: { bucket: val || undefined } }
                                      ]).catch(err => console.error('Failed to update bucket', err));
                                    }}
                                    className="absolute right-3 top-3 text-xs rounded-md border border-[#dbd6cf] px-2 py-1 bg-white focus:border-[#bb9e7b] focus:outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <option value="">No bucket</option>
                                    {availableBuckets.map((b) => (
                                      <option key={b} value={b}>{b}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  </div>
                </div>
              )}
            </Droppable>

            {/* Premium Add Task Form */}
            {!isDailyCollapsed && (
              <div className="p-4 bg-gradient-to-r from-[#faf8f5]/80 to-[#faf8f5]/40 rounded-xl border border-[#dbd6cf] space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-[#bb9e7b] flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <h5 className="text-sm font-medium text-[#314158]">Add task for today</h5>
                </div>

                {availableBuckets.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[#4a5568] block">Project</label>
                    <select
                      value={taskBucket}
                      onChange={(e) => setTaskBucket(e.target.value)}
                      className="w-full rounded-lg border border-[#dbd6cf] px-3 py-2.5 text-sm bg-white focus:border-[#bb9e7b] focus:ring-[3px] focus:ring-[rgba(163,133,96,0.15)] focus:outline-none transition-all duration-200"
                    >
                      {availableBuckets.map(bucket => (
                        <option key={bucket} value={bucket}>{bucket}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="What needs to be done today?"
                    value={newDailyTask}
                    onChange={(e) => setNewDailyTask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newDailyTask.trim()) handleAddDailyTask(); }}
                    className="flex-1 rounded-lg border border-[#dbd6cf] px-3 py-2.5 text-sm bg-white focus:border-[#bb9e7b] focus:ring-[3px] focus:ring-[rgba(163,133,96,0.15)] focus:outline-none transition-all duration-200 placeholder-[#8e99a8]/70"
                  />
                  <button
                    onClick={handleAddDailyTask}
                    disabled={!newDailyTask.trim()}
                    className="px-4 py-2.5 bg-theme-primary hover:bg-theme-primary/90 disabled:bg-[#ebe5de] text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:cursor-not-allowed shadow-sm hover:shadow-warm"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Upcoming view */}
        {taskView === 'Upcoming' && (
          <div className="space-y-4">
            {/* Render task groups */}
            {Object.entries(taskGroups).map(([groupKey, tasks]) => {
              if (tasks.length === 0) return null;

              const groupConfig = {
                overdue: { title: 'Overdue', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
                today: { title: 'Today', color: 'text-[#9a7b5a]', bgColor: 'bg-[#fdf8f6]', borderColor: 'border-[#dbd6cf]' },
                tomorrow: { title: 'Tomorrow', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
                thisWeek: { title: 'This Week', color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
                nextWeek: { title: 'Next Week', color: 'text-[#9a7b5a]', bgColor: 'bg-[#fdf8f6]', borderColor: 'border-[#dbd6cf]' },
                later: { title: 'Later', color: 'text-[#6b7688]', bgColor: 'bg-[#faf8f5]', borderColor: 'border-[#dbd6cf]' }
              }[groupKey] || { title: groupKey, color: 'text-[#6b7688]', bgColor: 'bg-[#faf8f5]', borderColor: 'border-[#dbd6cf]' };

              const isCollapsed = groupCollapsed[groupKey];

              // Add friendly date hints to group headers
              const now = new Date();
              const subtitle = (() => {
                switch (groupKey) {
                  case 'overdue':
                    return `Before ${format(now, 'EEE, MMM d')}`;
                  case 'today':
                    return `${format(now, 'EEE, MMM d')}`;
                  case 'tomorrow':
                    return `${format(addDays(now, 1), 'EEE, MMM d')}`;
                  case 'thisWeek': {
                    const s = startOfWeek(now);
                    const e = endOfWeek(now);
                    return `${format(s, 'MMM d')} – ${format(e, 'MMM d')}`;
                  }
                  case 'nextWeek': {
                    const s = startOfWeek(addWeeks(now, 1));
                    const e = endOfWeek(addWeeks(now, 1));
                    return `${format(s, 'MMM d')} – ${format(e, 'MMM d')}`;
                  }
                  case 'later': {
                    const after = endOfWeek(addWeeks(now, 1));
                    return `After ${format(after, 'EEE, MMM d')}`;
                  }
                  default:
                    return '';
                }
              })();

              return (
                <div key={groupKey} className="rounded-xl border border-[#dbd6cf] bg-white/80 shadow-sm overflow-hidden">
                  {/* Premium Group Header */}
                  <div
                    className={`flex items-center justify-between px-5 py-4 cursor-pointer select-none transition-all duration-200 hover:bg-[#faf8f5]/50`}
                    onClick={() => toggleGroupCollapse(groupKey)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg ${groupConfig.bgColor} flex items-center justify-center transition-transform duration-200 ${isCollapsed ? 'rotate-0' : 'rotate-90'}`}>
                        <ChevronRight size={14} className={groupConfig.color} />
                      </div>
                      <div>
                        <h4 className={`font-semibold text-sm ${groupConfig.color}`}>
                          {groupConfig.title}
                        </h4>
                        <p className="text-xs text-[#8e99a8] mt-0.5">
                          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                          {subtitle && (
                            <span className="ml-2 text-[#8e99a8]/70">{subtitle}</span>
                          )}
                          {groupKey === 'overdue' && tasks.length > 0 && (
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                              <AlertCircle size={10} />
                              Urgent
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Premium Group Tasks */}
                  <div
                    className={`transition-all duration-300 ease-out overflow-hidden ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100'
                      }`}
                  >
                    <div className="px-4 pb-4">
                      <Droppable droppableId={`upcoming-${groupKey}`}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-3"
                          >
                            {tasks.map((task: any, index: number) => (
                              <EnhancedTaskCard
                                key={task.id}
                                task={task}
                                index={index}
                                isExpanded={expandedTasks.has(task.id.toString())}
                                onToggle={toggleTaskCompletion}
                                onExpand={handleTaskExpand}
                                onQuickAction={handleQuickAction}
                                availableBuckets={availableBuckets}
                                batchUpdateTasks={batchUpdateTasks}
                                isRescheduleActive={rescheduleTaskId === task.id.toString()}
                                onRescheduleSelect={handleRescheduleSelect}
                                onRescheduleCancel={handleRescheduleCancel}
                                bucketColors={bucketColors}
                                onTaskClick={onTaskClick}
                              />
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Premium Empty State */}
            {Object.values(taskGroups).every(group => group.length === 0) && !loading && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-[#f5ede4] flex items-center justify-center mx-auto mb-4">
                  <Clock size={28} className="text-[#9a7b5a]" />
                </div>
                <h3 className="text-lg font-semibold text-[#314158] mb-2">All caught up!</h3>
                <p className="text-sm text-[#8e99a8] mb-6 max-w-sm mx-auto">
                  You have no upcoming tasks. Take a moment to plan ahead or enjoy the calm.
                </p>
                <button
                  onClick={() => {
                    // Focus the add task input
                    const input = document.querySelector('[placeholder*="upcoming"]') as HTMLInputElement;
                    input?.focus();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#bb9e7b] hover:bg-[#9a7b5a] text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-warm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add your first upcoming task
                </button>
              </div>
            )}

            {/* Premium Add Upcoming Task Form */}
            <div className="mt-6 p-5 bg-gradient-to-r from-[#faf8f5]/80 to-[#faf8f5]/40 rounded-xl border border-[#dbd6cf] space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-[#bb9e7b] flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h5 className="text-sm font-medium text-[#314158]">Plan ahead</h5>
              </div>

              {availableBuckets.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#4a5568] block">Project</label>
                  <select
                    value={taskBucket}
                    onChange={(e) => setTaskBucket(e.target.value)}
                    className="w-full rounded-lg border border-[#dbd6cf] px-3 py-2.5 text-sm bg-white focus:border-[#bb9e7b] focus:ring-[3px] focus:ring-[rgba(163,133,96,0.15)] focus:outline-none transition-all duration-200"
                  >
                    {availableBuckets.map(bucket => (
                      <option key={bucket} value={bucket}>{bucket}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#4a5568] block">Task description</label>
                  <input
                    type="text"
                    placeholder="What do you need to do?"
                    value={newUpcomingTask}
                    onChange={(e) => setNewUpcomingTask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newUpcomingTask.trim() && newUpcomingTaskDate) handleAddUpcomingTask(); }}
                    className="w-full rounded-lg border border-[#dbd6cf] px-3 py-2.5 text-sm bg-white focus:border-[#bb9e7b] focus:ring-[3px] focus:ring-[rgba(163,133,96,0.15)] focus:outline-none transition-all duration-200 placeholder-[#8e99a8]/70"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-medium text-[#4a5568] block">Due date</label>
                    <input
                      type="date"
                      value={newUpcomingTaskDate}
                      onChange={(e) => setNewUpcomingTaskDate(e.target.value)}
                      min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                      className="w-full rounded-lg border border-[#dbd6cf] px-3 py-2.5 text-sm bg-white focus:border-[#bb9e7b] focus:ring-[3px] focus:ring-[rgba(163,133,96,0.15)] focus:outline-none transition-all duration-200"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleAddUpcomingTask}
                      disabled={!newUpcomingTask.trim() || !newUpcomingTaskDate}
                      className="px-5 py-2.5 bg-[#bb9e7b] hover:bg-[#9a7b5a] disabled:bg-[#ebe5de] text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:cursor-not-allowed shadow-sm hover:shadow-warm"
                    >
                      Add Task
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Master List tab: show today tasks first, then open tasks */}
        {taskView === 'Master List' && (
          <div className="space-y-6">
            {/* Today's Tasks Section in Master List */}
            <Droppable droppableId="masterTodayTasks">
              {(provided: any) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-4"
                >
                  <div
                    className="flex items-center justify-between group cursor-pointer select-none py-2"
                    onClick={() => setIsDailyCollapsed((c) => !c)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg bg-[#bb9e7b] flex items-center justify-center transition-transform duration-200 ${isDailyCollapsed ? 'rotate-0' : 'rotate-90'}`}>
                        <ChevronRight size={14} className="text-white" />
                      </div>
                      <div>
                        <h4 className="section-label">Today&apos;s Tasks</h4>
                        <p className="text-sm text-[#8e99a8]">{todayTasks.length} {todayTasks.length === 1 ? 'task' : 'tasks'}</p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`transition-all duration-300 ease-out overflow-hidden ${isDailyCollapsed ? 'max-h-0 opacity-0' : 'max-h-[400px] opacity-100'
                      }`}
                  >
                    <div className="space-y-3">
                      {loading && todayTasks.length === 0 ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse">
                              <div className="bg-[rgba(183,148,106,0.08)] h-16 rounded-xl"></div>
                            </div>
                          ))}
                        </div>
                      ) : !loading && todayTasks.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="w-12 h-12 rounded-xl bg-[#f5ede4] flex items-center justify-center mx-auto mb-3">
                            <Clock size={20} className="text-[#9a7b5a]" />
                          </div>
                          <h5 className="text-sm font-medium text-[#314158] mb-1">No tasks for today</h5>
                          <p className="text-xs text-[#8e99a8]">Drag a task from "All Open Tasks" below to add it to today</p>
                        </div>
                      ) : (
                        todayTasksOrdered.map((t: any, index: number) => (
                          <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                            {(provided: any) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={provided.draggableProps.style}
                                className="group relative bg-white border border-[#dbd6cf] hover:border-[#dbd6cf] rounded-xl p-4 transition-all duration-200 hover:shadow-warm cursor-grab active:cursor-grabbing"
                              >
                                <div className="flex items-start gap-3">
                                  <label className="flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={t.completed ?? false}
                                      onChange={() => toggleTaskCompletion(t.id.toString())}
                                      className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded-lg border-2 transition-all duration-200 flex items-center justify-center ${t.completed
                                        ? 'bg-[#bb9e7b] border-[#bb9e7b]'
                                        : 'border-[#dbd6cf] hover:border-[#bb9e7b] group-hover:border-[#bb9e7b]'
                                      }`}>
                                      {t.completed && (
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                  </label>
                                  <div
                                    className="flex-1 min-w-0 cursor-pointer"
                                    onClick={() => onTaskClick?.(t.id.toString(), todayStr)}
                                  >
                                    <p className={`text-sm font-medium leading-relaxed transition-all duration-200 ${t.completed ? 'line-through text-[#8e99a8]/70' : 'text-[#314158]'
                                      }`}>
                                      {t.content}
                                    </p>
                                    {t.bucket && (
                                      <div className="mt-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBucketColorClasses(t.bucket, bucketColors)}`}
                                          style={getCustomBucketStyles(t.bucket, bucketColors)}
                                        >
                                          {t.bucket}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {/* Hover bucket selector for Master List Today tasks */}
                                {availableBuckets?.length > 0 && (
                                  <select
                                    aria-label="Change bucket"
                                    title="Change bucket"
                                    value={t.bucket || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      batchUpdateTasks([
                                        { taskId: t.id.toString(), updates: { bucket: val || undefined } }
                                      ]).catch(err => console.error('Failed to update bucket', err));
                                    }}
                                    className="absolute right-3 top-3 text-xs rounded-md border border-[#dbd6cf] px-2 py-1 bg-white focus:border-[#bb9e7b] focus:outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <option value="">No bucket</option>
                                    {availableBuckets.map((b) => (
                                      <option key={b} value={b}>{b}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  </div>
                </div>
              )}
            </Droppable>

            {/* All Open Tasks Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div
                  className="flex items-center gap-2 text-sm font-medium text-[#314158] select-none cursor-pointer"
                  onClick={() => setIsOpenCollapsed((c) => !c)}
                >
                  <span>All Open Tasks</span>
                  {isOpenCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              <Droppable droppableId="openTasks">
                {(provided: any) => (
                  <ul
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2 text-sm text-[#4a5568] pr-1 transition-[max-height] duration-200"
                    style={{
                      maxHeight: isOpenCollapsed ? 0 : '60vh',
                      overflowY: isOpenCollapsed ? 'hidden' : 'auto'
                    }}
                  >
                    {loading && openTasksToShow.length === 0 ? (
                      <li className="text-[#8e99a8]">Loading…</li>
                    ) : null}

                    {!loading && openTasksToShow.length === 0 ? (
                      <li className="text-[#8e99a8]">No open tasks</li>
                    ) : null}

                    {openTasksToShow.map((t: any, index: number) => (
                      <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                        {(provided: any) => (
                          <li
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={provided.draggableProps.style}
                            className="group relative bg-white border border-[#dbd6cf] hover:border-[#dbd6cf] rounded-xl p-4 transition-all duration-200 hover:shadow-warm cursor-grab active:cursor-grabbing"
                          >
                            <div className="flex items-start gap-3">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={t.completed ?? false}
                                  onChange={() => toggleTaskCompletion(t.id.toString())}
                                  className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded-lg border-2 transition-all duration-200 flex items-center justify-center ${t.completed
                                    ? 'bg-[#bb9e7b] border-[#bb9e7b]'
                                    : 'border-[#dbd6cf] hover:border-[#bb9e7b] group-hover:border-[#bb9e7b]'
                                  }`}>
                                  {t.completed && (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </label>
                              <div
                                className="flex-1 min-w-0 cursor-pointer"
                                onClick={() => onTaskClick?.(t.id.toString(), t.due?.date || todayStr)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium leading-relaxed transition-all duration-200 ${t.completed ? 'line-through text-[#8e99a8]/70' : 'text-[#314158]'
                                      }`}>
                                      {t.content}
                                    </p>
                                    {t.bucket && (
                                      <div className="mt-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBucketColorClasses(t.bucket, bucketColors)}`}
                                          style={getCustomBucketStyles(t.bucket, bucketColors)}
                                        >
                                          {t.bucket}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {/* Hover bucket selector */}
                              {availableBuckets?.length > 0 && (
                                <select
                                  aria-label="Change bucket"
                                  title="Change bucket"
                                  value={t.bucket || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    batchUpdateTasks([
                                      { taskId: t.id.toString(), updates: { bucket: val || undefined } }
                                    ]).catch(err => console.error('Failed to update bucket', err));
                                  }}
                                  className="absolute right-3 top-3 text-xs rounded-md border border-[#dbd6cf] px-2 py-1 bg-white focus:border-[#bb9e7b] focus:outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
                                >
                                  <option value="">No bucket</option>
                                  {availableBuckets.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </li>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </ul>
                )}
              </Droppable>

              {/* Add open task */}
              {!isOpenCollapsed && (
                <div className="mt-2 space-y-2">
                  {availableBuckets.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[#6b7688] font-medium">Bucket:</label>
                      <select
                        value={taskBucket}
                        onChange={(e) => setTaskBucket(e.target.value)}
                        className="flex-1 rounded-md border border-[#dbd6cf] px-3 py-1.5 text-sm focus:border-[#bb9e7b] focus:ring-1 focus:ring-[#bb9e7b] focus:outline-none bg-white"
                      >
                        {availableBuckets.map(bucket => (
                          <option key={bucket} value={bucket}>{bucket}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add open task…"
                      value={newOpenTask}
                      onChange={(e) => setNewOpenTask(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddOpenTask(); }}
                      className="flex-1 rounded border border-[#dbd6cf] px-2 py-1 text-sm focus:border-[#bb9e7b] focus:outline-none"
                    />
                    <button
                      onClick={handleAddOpenTask}
                      disabled={!newOpenTask.trim()}
                      className="px-4 py-2.5 bg-theme-primary hover:bg-theme-primary/90 disabled:bg-[#ebe5de] text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:cursor-not-allowed shadow-sm hover:shadow-warm"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }
}
