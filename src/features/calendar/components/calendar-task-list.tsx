"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { format, isToday, isTomorrow, isThisWeek, isWithinInterval, addDays, startOfWeek, endOfWeek, addWeeks, isBefore, startOfDay, differenceInDays, parse } from "date-fns";
import { ChevronRight, ChevronDown, ChevronLeft, Clock, Star, Calendar, AlertCircle, ChevronUp, MoreHorizontal } from "lucide-react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { useTaskData, useTaskActions } from "@/contexts/tasks-context";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getBucketColorSync, UNASSIGNED_BUCKET_ID } from "@/lib/bucket-colors";
import { getUserPreferencesClient } from "@/lib/user-preferences";
import { normalizeBucketId, toDayKey } from "@/features/calendar/types";
import { EnhancedTaskCard, getCustomBucketStyles } from "@/features/calendar/components/calendar-task-card";
import { useTaskOrdering } from "@/features/calendar/hooks/use-task-ordering";
import { HabitChecklistPanel } from "@/features/calendar/components/habit-checklist-panel";

// ---- Bucket mapping helpers ----
const UNASSIGNED_BUCKET_LABEL = "Unsorted";

// Module-scope color maps — allocated once, shared across all renders
const BUCKET_COLOR_CLASS_MAP: Record<string, string> = {
  "#6B8AF7": "bg-[#f0f3fe] text-[#5570c7] border-[#c8d3f9]",
  "#48B882": "bg-[#eefaf3] text-[#3a9468] border-[#b0e3cb]",
  "#D07AA4": "bg-[#fdf1f6] text-[#b05c86] border-[#ebc3d6]",
  "#4AADE0": "bg-[#eef7fc] text-[#3889b5] border-[#b0daf0]",
  "#C4A44E": "bg-[#faf6ec] text-[#9e843e] border-[#e0d4a8]",
  "#8B7FD4": "bg-[#f3f1fb] text-[#6f65aa] border-[#c8c2e8]",
  "#E28A5D": "bg-[#fdf3ee] text-[#b56e4a] border-[#f0c8b3]",
  "#5E9B8C": "bg-[#eff7f5] text-[#4b7c70] border-[#b8d8cf]",
  "#8e99a8": "bg-theme-brand-tint-light text-theme-text-subtle border-theme-neutral-300",
  "#4F46E5": "bg-theme-surface-selected text-theme-primary-600 border-theme-neutral-300",
  "#22C55E": "bg-[#eefaf3] text-[#3a9468] border-[#b0e3cb]",
  "#F97316": "bg-orange-100 text-orange-700 border-orange-200",
  "#EC4899": "bg-pink-100 text-pink-700 border-pink-200",
  "#14B8A6": "bg-teal-100 text-teal-700 border-teal-200",
  "#8B5CF6": "bg-[#f3f1fb] text-[#6f65aa] border-[#c8c2e8]",
  "#F59E0B": "bg-amber-100 text-amber-700 border-amber-200",
  "#06B6D4": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "#94A3B8": "bg-theme-brand-tint-light text-theme-text-subtle border-theme-neutral-300",
  "#ff52bf": "bg-pink-100 text-pink-700 border-pink-200",
};

const getBucketColorClasses = (bucketName?: string | null, bucketColors?: Record<string, string>) => {
  if (!bucketName) return "bg-theme-brand-tint-light text-theme-text-subtle border-theme-neutral-300";
  const color = getBucketColorSync(normalizeBucketId(bucketName), bucketColors);
  return BUCKET_COLOR_CLASS_MAP[color] ?? "border border-theme-neutral-300 custom-bucket-color";
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
  dashboardView?: boolean; // Simplified view for dashboard usage
  onCollapsedChange?: (collapsed: boolean) => void;
  onTaskClick?: (taskId: string, dateStr: string) => void; // Callback when a task is clicked
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

export function CalendarTaskList({ selectedDate = new Date(), availableBuckets = [], selectedBucket, isDragging = false, dashboardView = false, onCollapsedChange, onTaskClick }: CalendarTaskListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDailyCollapsed, setIsDailyCollapsed] = useState(false);
  const [isOpenCollapsed, setIsOpenCollapsed] = useState(false);
  const [taskView, setTaskView] = useState<'Habits' | 'Upcoming' | 'Master List'>('Habits');
  const [bucketColors, setBucketColors] = useState<Record<string, string>>({});

  // Use unified task context
  const {
    allTasks,
    upcomingTasks,
    loading,
  } = useTaskData();
  const {
    createTask,
    toggleTaskCompletion,
    batchUpdateTasks,
  } = useTaskActions();

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
  const [masterListBucketFilter, setMasterListBucketFilter] = useState<string>("all");

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

  // Sync new-task bucket when the master list filter changes
  useEffect(() => {
    if (!dashboardView && masterListBucketFilter !== "all") {
      setTaskBucket(masterListBucketFilter);
    }
  }, [masterListBucketFilter, dashboardView]);

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
  const todayStr = useMemo(() => toDayKey(referenceDate), [referenceDate]);
  const todayTasks = useMemo(() => {
    // In calendar master list, include time-slotted tasks so it's a complete view of the day
    let filtered = allTasks.filter(t => (dashboardView ? !t.hourSlot : true) && doesTaskOccurOnDate(t, todayStr));

    // Filter by selectedBucket in dashboard view
    if (selectedBucket && dashboardView) {
      filtered = filtered.filter(t => !t.bucket || t.bucket === selectedBucket);
    }

    // Filter by masterListBucketFilter in calendar view
    if (!dashboardView && masterListBucketFilter !== "all") {
      filtered = filtered.filter(t => t.bucket === masterListBucketFilter);
    }

    return filtered;
  }, [allTasks, todayStr, selectedBucket, dashboardView, masterListBucketFilter]);

  // Open tasks (only shown in Master List tab)
  // Exclude tasks already in todayTasks to prevent duplicate draggableIds
  // which cause "Invariant failed" in @hello-pangea/dnd.
  const openTasksBase = useMemo(() => {
    const todayIds = new Set(todayTasks.map(t => t.id.toString()));
    let filtered = allTasks.filter(t => !t.completed && !t.hourSlot && !todayIds.has(t.id.toString()));

    // Filter by selectedBucket in dashboard view
    if (selectedBucket && dashboardView) {
      filtered = filtered.filter(t => !t.bucket || t.bucket === selectedBucket);
    }

    // Filter by masterListBucketFilter in calendar view
    if (!dashboardView && masterListBucketFilter !== "all") {
      filtered = filtered.filter(t => t.bucket === masterListBucketFilter);
    }

    return filtered;
  }, [allTasks, todayTasks, selectedBucket, dashboardView, masterListBucketFilter]);

  // Task ordering: localStorage-persisted today order + position-based open tasks order
  const { todayTasksOrdered, openTasksToShow } = useTaskOrdering({
    todayTasks,
    openTasksBase,
    todayStr,
    batchUpdateTasks,
  });

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

  if (isCollapsed) {
    return (
      <div className="w-14 bg-white/95 backdrop-blur-sm border border-theme-neutral-300 rounded-xl shadow-sm p-3">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-8 h-8 hover:bg-theme-brand-tint-light/80 rounded-lg transition-all duration-200 flex items-center justify-center group"
          aria-label="Expand task list"
        >
          <ChevronLeft size={18} className="text-theme-text-tertiary group-hover:text-theme-text-body transition-colors" />
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
                <div className="bg-theme-brand-tint-light h-16 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : !loading && dashboardTasks.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-xl bg-theme-surface-selected flex items-center justify-center mx-auto mb-3">
              <Clock size={20} className="text-theme-primary-600" />
            </div>
            <h5 className="text-sm font-medium text-theme-text-primary mb-1">No tasks</h5>
            <p className="text-xs text-theme-text-tertiary">Add a task to get started</p>
          </div>
        ) : (
          dashboardTasks.map((task: any, index: number) => (
            <div
              key={task.id}
              className="group relative bg-white border border-theme-neutral-300 hover:border-theme-neutral-300 rounded-xl p-4 transition-all duration-200 hover:shadow-warm"
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
                      ? 'bg-theme-secondary border-theme-secondary'
                      : 'border-theme-neutral-300 hover:border-theme-secondary group-hover:border-theme-secondary'
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
                  <p className={`text-sm font-medium leading-relaxed transition-all duration-200 ${task.completed ? 'line-through text-theme-text-tertiary/70' : 'text-theme-text-primary'
                    }`}>
                    {task.content}
                  </p>
                  {/* Display due date if available */}
                  {task.due?.date && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-theme-brand-tint-light text-theme-text-subtle border border-theme-neutral-300">
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
        <div className="p-4 bg-gradient-to-r from-theme-surface-alt/80 to-theme-surface-alt/40 rounded-xl border border-theme-neutral-300 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-theme-secondary flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h5 className="text-sm font-medium text-theme-text-primary">Add task</h5>
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              placeholder="What needs to be done?"
              value={newOpenTask}
              onChange={(e) => setNewOpenTask(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newOpenTask.trim()) handleAddOpenTask(); }}
              className="flex-1 rounded-lg border border-theme-neutral-300 px-3 py-2.5 text-sm bg-white focus:border-theme-secondary focus:ring-[3px] focus:ring-theme-focus/15 focus:outline-none transition-all duration-200 placeholder-theme-text-tertiary/70"
            />
            <button
              onClick={handleAddOpenTask}
              disabled={!newOpenTask.trim()}
              className="px-4 py-2.5 bg-theme-primary hover:bg-theme-primary/90 disabled:bg-theme-skeleton text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:cursor-not-allowed shadow-sm hover:shadow-warm"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full bg-white/95 backdrop-blur-sm border border-theme-neutral-300 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-theme-neutral-300/60/80 bg-gradient-to-r from-theme-surface-alt/30 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="section-label-sm">Tasks</h3>
            <p className=" text-[13px] text-theme-text-tertiary mt-1">Organize your workflow</p>
          </div>
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-8 h-8 hover:bg-theme-brand-tint-light/80 rounded-lg transition-all duration-200 flex items-center justify-center group"
            aria-label="Collapse task list"
          >
            <ChevronRight size={18} className="text-theme-text-tertiary/70 group-hover:text-theme-text-subtle transition-colors" />
          </button>
        </div>
      </div>

      {/* Premium Task view toggle */}
      <div className="px-6 py-4 bg-theme-surface-alt/40">
        <div className="relative flex rounded-xl bg-white border border-theme-neutral-300 p-1 shadow-sm">
          {/* Background slider */}
          <div
            className={`absolute top-1 h-8 bg-theme-secondary rounded-lg shadow-sm transition-all duration-300 ease-out`}
            style={{
              width: 'calc(33.333% - 4px)',
              transform: `translateX(${taskView === 'Habits' ? '2px' : taskView === 'Upcoming' ? 'calc(100% + 2px)' : 'calc(200% + 2px)'})`
            }}
          />
          {(['Habits', 'Upcoming', 'Master List'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTaskView(tab)}
              className={`relative z-10 flex-1 h-8 px-4 text-sm font-medium rounded-lg transition-all duration-300 ease-out whitespace-nowrap ${taskView === tab
                  ? 'text-white'
                  : 'text-theme-text-subtle hover:text-theme-text-primary'
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
          {renderTaskContent()}
        </div>
      </div>
    </div>
  );

  function renderTaskContent() {
    return (
      <>
        {taskView === 'Habits' && (
          <HabitChecklistPanel selectedDate={selectedDate} isDragging={isDragging} />
        )}

        {/* Enhanced Upcoming view */}
        {taskView === 'Upcoming' && (
          <div className="space-y-4">
            {/* Render task groups */}
            {Object.entries(taskGroups).map(([groupKey, tasks]) => {
              if (tasks.length === 0) return null;

              const groupConfig = {
                overdue: { title: 'Overdue', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
                today: { title: 'Today', color: 'text-theme-primary-600', bgColor: 'bg-theme-primary-50', borderColor: 'border-theme-neutral-300' },
                tomorrow: { title: 'Tomorrow', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
                thisWeek: { title: 'This Week', color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
                nextWeek: { title: 'Next Week', color: 'text-theme-primary-600', bgColor: 'bg-theme-primary-50', borderColor: 'border-theme-neutral-300' },
                later: { title: 'Later', color: 'text-theme-text-subtle', bgColor: 'bg-theme-surface-alt', borderColor: 'border-theme-neutral-300' }
              }[groupKey] || { title: groupKey, color: 'text-theme-text-subtle', bgColor: 'bg-theme-surface-alt', borderColor: 'border-theme-neutral-300' };

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
                <div key={groupKey} className="rounded-xl border border-theme-neutral-300 bg-white/80 shadow-sm overflow-hidden">
                  {/* Premium Group Header */}
                  <div
                    className={`flex items-center justify-between px-5 py-4 cursor-pointer select-none transition-all duration-200 hover:bg-theme-surface-alt/50`}
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
                        <p className="text-xs text-theme-text-tertiary mt-0.5">
                          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                          {subtitle && (
                            <span className="ml-2 text-theme-text-tertiary/70">{subtitle}</span>
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
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`space-y-3 rounded-xl transition-all duration-200 ${snapshot.isDraggingOver ? 'ring-2 ring-theme-secondary/40 bg-theme-brand-tint-subtle/20' : ''}`}
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
                <div className="w-16 h-16 rounded-2xl bg-theme-surface-selected flex items-center justify-center mx-auto mb-4">
                  <Clock size={28} className="text-theme-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-theme-text-primary mb-2">All caught up!</h3>
                <p className="text-sm text-theme-text-tertiary mb-6 max-w-sm mx-auto">
                  You have no upcoming tasks. Take a moment to plan ahead or enjoy the calm.
                </p>
                <button
                  onClick={() => {
                    // Focus the add task input
                    const input = document.querySelector('[placeholder*="upcoming"]') as HTMLInputElement;
                    input?.focus();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-theme-secondary hover:bg-theme-primary-600 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-warm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add your first upcoming task
                </button>
              </div>
            )}

            {/* Premium Add Upcoming Task Form */}
            <div className="mt-6 p-5 bg-gradient-to-r from-theme-surface-alt/80 to-theme-surface-alt/40 rounded-xl border border-theme-neutral-300 space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-theme-secondary flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h5 className="text-sm font-medium text-theme-text-primary">Plan ahead</h5>
              </div>

              {availableBuckets.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-theme-text-body block">Project</label>
                  <select
                    value={taskBucket}
                    onChange={(e) => setTaskBucket(e.target.value)}
                    className="w-full rounded-lg border border-theme-neutral-300 px-3 py-2.5 text-sm bg-white focus:border-theme-secondary focus:ring-[3px] focus:ring-theme-focus/15 focus:outline-none transition-all duration-200"
                  >
                    {availableBuckets.map(bucket => (
                      <option key={bucket} value={bucket}>{bucket}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-theme-text-body block">Task description</label>
                  <input
                    type="text"
                    placeholder="What do you need to do?"
                    value={newUpcomingTask}
                    onChange={(e) => setNewUpcomingTask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newUpcomingTask.trim() && newUpcomingTaskDate) handleAddUpcomingTask(); }}
                    className="w-full rounded-lg border border-theme-neutral-300 px-3 py-2.5 text-sm bg-white focus:border-theme-secondary focus:ring-[3px] focus:ring-theme-focus/15 focus:outline-none transition-all duration-200 placeholder-theme-text-tertiary/70"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-medium text-theme-text-body block">Due date</label>
                    <input
                      type="date"
                      value={newUpcomingTaskDate}
                      onChange={(e) => setNewUpcomingTaskDate(e.target.value)}
                      min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                      className="w-full rounded-lg border border-theme-neutral-300 px-3 py-2.5 text-sm bg-white focus:border-theme-secondary focus:ring-[3px] focus:ring-theme-focus/15 focus:outline-none transition-all duration-200"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleAddUpcomingTask}
                      disabled={!newUpcomingTask.trim() || !newUpcomingTaskDate}
                      className="px-5 py-2.5 bg-theme-secondary hover:bg-theme-primary-600 disabled:bg-theme-skeleton text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:cursor-not-allowed shadow-sm hover:shadow-warm"
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
            {/* Bucket filter for calendar view */}
            {!dashboardView && availableBuckets.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setMasterListBucketFilter("all")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150 ${
                    masterListBucketFilter === "all"
                      ? "bg-theme-secondary text-white border-theme-secondary shadow-sm"
                      : "bg-white text-theme-text-subtle border-theme-neutral-300 hover:border-theme-secondary/50 hover:text-theme-text-primary"
                  }`}
                >
                  All Buckets
                </button>
                {availableBuckets.map((bucket) => {
                  const isActive = masterListBucketFilter === bucket;
                  const colorClasses = getBucketColorClasses(bucket, bucketColors);
                  return (
                    <button
                      key={bucket}
                      onClick={() => setMasterListBucketFilter(bucket)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150 ${
                        isActive
                          ? `${colorClasses} ring-1 ring-offset-1 ring-theme-secondary/40 shadow-sm`
                          : "bg-white text-theme-text-subtle border-theme-neutral-300 hover:border-theme-secondary/50 hover:text-theme-text-primary"
                      }`}
                    >
                      {bucket}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Today's Tasks Section in Master List */}
            <Droppable droppableId="masterTodayTasks">
              {(provided: any, snapshot: any) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`space-y-4 rounded-xl transition-all duration-200 ${snapshot.isDraggingOver ? 'ring-2 ring-theme-secondary/40 bg-theme-brand-tint-subtle/20' : ''}`}
                >
                  <div
                    className="flex items-center justify-between group cursor-pointer select-none py-2"
                    onClick={() => setIsDailyCollapsed((c) => !c)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg bg-theme-secondary flex items-center justify-center transition-transform duration-200 ${isDailyCollapsed ? 'rotate-0' : 'rotate-90'}`}>
                        <ChevronRight size={14} className="text-white" />
                      </div>
                      <div>
                        <h4 className="section-label">Today&apos;s Tasks</h4>
                        <p className="text-sm text-theme-text-tertiary">{todayTasks.length} {todayTasks.length === 1 ? 'task' : 'tasks'}</p>
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
                              <div className="bg-theme-brand-tint-light h-16 rounded-xl"></div>
                            </div>
                          ))}
                        </div>
                      ) : !loading && todayTasks.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="w-12 h-12 rounded-xl bg-theme-surface-selected flex items-center justify-center mx-auto mb-3">
                            <Clock size={20} className="text-theme-primary-600" />
                          </div>
                          <h5 className="text-sm font-medium text-theme-text-primary mb-1">No tasks for today</h5>
                          <p className="text-xs text-theme-text-tertiary">Drag a task from "All Open Tasks" below to add it to today</p>
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
                                className="group relative bg-white border border-theme-neutral-300 hover:border-theme-neutral-300 rounded-xl p-4 transition-all duration-200 hover:shadow-warm cursor-grab active:cursor-grabbing"
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
                                        ? 'bg-theme-secondary border-theme-secondary'
                                        : 'border-theme-neutral-300 hover:border-theme-secondary group-hover:border-theme-secondary'
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
                                    <p className={`text-sm font-medium leading-relaxed transition-all duration-200 ${t.completed ? 'line-through text-theme-text-tertiary/70' : 'text-theme-text-primary'
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
                                    className="absolute right-3 top-3 text-xs rounded-md border border-theme-neutral-300 px-2 py-1 bg-white focus:border-theme-secondary focus:outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
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
                  className="flex items-center gap-2 text-sm font-medium text-theme-text-primary select-none cursor-pointer"
                  onClick={() => setIsOpenCollapsed((c) => !c)}
                >
                  <span>All Open Tasks</span>
                  {isOpenCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              <Droppable droppableId="openTasks">
                {(provided: any, snapshot: any) => (
                  <ul
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 text-sm text-theme-text-body pr-1 transition-[max-height] duration-200 rounded-xl ${snapshot.isDraggingOver ? 'ring-2 ring-theme-secondary/40 bg-theme-brand-tint-subtle/20' : ''}`}
                    style={{
                      maxHeight: isOpenCollapsed ? 0 : '60vh',
                      overflowY: isOpenCollapsed ? 'hidden' : 'auto'
                    }}
                  >
                    {loading && openTasksToShow.length === 0 ? (
                      <li className="text-theme-text-tertiary">Loading…</li>
                    ) : null}

                    {!loading && openTasksToShow.length === 0 ? (
                      <li className="text-theme-text-tertiary">No open tasks</li>
                    ) : null}

                    {openTasksToShow.map((t: any, index: number) => (
                      <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                        {(provided: any) => (
                          <li
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={provided.draggableProps.style}
                            className="group relative bg-white border border-theme-neutral-300 hover:border-theme-neutral-300 rounded-xl p-4 transition-all duration-200 hover:shadow-warm cursor-grab active:cursor-grabbing"
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
                                    ? 'bg-theme-secondary border-theme-secondary'
                                    : 'border-theme-neutral-300 hover:border-theme-secondary group-hover:border-theme-secondary'
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
                                    <p className={`text-sm font-medium leading-relaxed transition-all duration-200 ${t.completed ? 'line-through text-theme-text-tertiary/70' : 'text-theme-text-primary'
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
                                  className="absolute right-3 top-3 text-xs rounded-md border border-theme-neutral-300 px-2 py-1 bg-white focus:border-theme-secondary focus:outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
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
                  {availableBuckets.length > 0 && (!dashboardView ? masterListBucketFilter === "all" : true) && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-theme-text-subtle font-medium">Bucket:</label>
                      <select
                        value={taskBucket}
                        onChange={(e) => setTaskBucket(e.target.value)}
                        className="flex-1 rounded-md border border-theme-neutral-300 px-3 py-1.5 text-sm focus:border-theme-secondary focus:ring-1 focus:ring-theme-secondary focus:outline-none bg-white"
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
                      className="flex-1 rounded border border-theme-neutral-300 px-2 py-1 text-sm focus:border-theme-secondary focus:outline-none"
                    />
                    <button
                      onClick={handleAddOpenTask}
                      disabled={!newOpenTask.trim()}
                      className="px-4 py-2.5 bg-theme-primary hover:bg-theme-primary/90 disabled:bg-theme-skeleton text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:cursor-not-allowed shadow-sm hover:shadow-warm"
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
