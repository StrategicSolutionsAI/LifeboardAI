"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  differenceInCalendarDays,
  format,
  isPast,
  isToday,
  parseISO,
} from "date-fns";
import type { Task } from "@/types/tasks";
import { useTasksContext } from "@/contexts/tasks-context";
import { useToast } from "@/components/ui/use-toast";
import { TasksQuickActions, type TasksQuickActionFilter } from "./tasks-quick-actions";
import { TasksGroupedList } from "./tasks-grouped-list";
import { TasksDailyProgress } from "./tasks-daily-progress";
import { ExternalLink, LayoutDashboard, ListChecks, Pencil, Zap } from "lucide-react";

interface EnhancedTasksViewProps {
  activeBucket: string;
  buckets: string[];
  linkedTaskMap?: Record<string, { bucket: string; widgetId: string }>;
  onToggleTaskWidget?: (task: Task) => Promise<void>;
  onEditTask?: (taskId: string) => void;
}

type DueBadgeTone = "default" | "accent" | "destructive";
type DueBadge = { label: string; tone: DueBadgeTone };

const parseDueDate = (task: Task): Date | null => {
  const raw = task.due?.date ?? task.due?.datetime ?? null;
  if (!raw) return null;

  try {
    const normalized = raw.length === 10 ? `${raw}T00:00:00` : raw;
    const parsed = parseISO(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
};

const isOverdueTask = (task: Task) => {
  const dueDate = parseDueDate(task);
  if (!dueDate) return false;
  return isPast(dueDate) && !isToday(dueDate) && !task.due?.is_recurring;
};

const isDueSoonTask = (task: Task) => {
  const dueDate = parseDueDate(task);
  if (!dueDate) return false;
  const diff = differenceInCalendarDays(dueDate, new Date());
  return diff >= 0 && diff <= 3;
};

const getDueBadge = (task: Task): DueBadge | null => {
  const dueDate = parseDueDate(task);
  if (!dueDate) return null;

  const diff = differenceInCalendarDays(dueDate, new Date());
  if (diff < 0 && !task.due?.is_recurring) {
    return { label: "Overdue", tone: "destructive" };
  }
  if (diff === 0) {
    return { label: "Today", tone: "accent" };
  }
  if (diff === 1) {
    return { label: "Tomorrow", tone: "accent" };
  }
  return {
    label: format(dueDate, "MMM d"),
    tone: diff <= 3 ? "accent" : "default",
  };
};

const dueBadgeClasses: Record<DueBadgeTone, string> = {
  default: "border-theme-neutral-300 bg-[rgba(250,248,245,0.5)] text-theme-text-tertiary",
  accent: "border-theme-primary/30 bg-theme-brand-tint-light text-theme-primary",
  destructive: "border-red-200 bg-red-50 text-red-600",
};

export function EnhancedTasksView({
  activeBucket,
  buckets,
  linkedTaskMap,
  onToggleTaskWidget,
  onEditTask,
}: EnhancedTasksViewProps) {
  const { allTasks, createTask, toggleTaskCompletion } = useTasksContext();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState("open");
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
  const [updatingCompletion, setUpdatingCompletion] = useState<Set<string>>(new Set());
  const linkedMap = linkedTaskMap ?? {};

  const bucketTasks = useMemo(() => {
    const tasks = Array.isArray(allTasks) ? allTasks : [];
    const seen = new Set<string>();
    const normalize = (value?: string | null) => (value ?? "").trim().toLowerCase();
    const activeBucketKey = normalize(activeBucket);

    return tasks.filter((task) => {
      if (seen.has(task.id)) {
        return false;
      }
      if (activeBucketKey) {
        const taskBucketKey = normalize(task.bucket);
        if (taskBucketKey !== activeBucketKey) {
          return false;
        }
      }
      seen.add(task.id);
      return true;
    });
  }, [allTasks, activeBucket]);

  const openTasks = useMemo(
    () => bucketTasks.filter((task) => !task.completed),
    [bucketTasks],
  );

  const completedTasks = useMemo(
    () => bucketTasks.filter((task) => task.completed),
    [bucketTasks],
  );

  const taskCounts = useMemo(() => {
    let dueSoon = 0;
    let overdue = 0;

    openTasks.forEach((task) => {
      if (isDueSoonTask(task)) dueSoon += 1;
      if (isOverdueTask(task)) overdue += 1;
    });

    return {
      open: openTasks.length,
      completed: completedTasks.length,
      dueSoon,
      overdue,
    };
  }, [openTasks, completedTasks]);

  const quickFilters = useMemo<TasksQuickActionFilter[]>(
    () => [
      { key: "open", label: "All Open", count: taskCounts.open },
      {
        key: "due-soon",
        label: "Due Soon",
        count: taskCounts.dueSoon,
        disabled: taskCounts.dueSoon === 0 && activeFilter !== "due-soon",
      },
      {
        key: "overdue",
        label: "Overdue",
        count: taskCounts.overdue,
        emphasis: "destructive",
        disabled: taskCounts.overdue === 0 && activeFilter !== "overdue",
      },
      { key: "completed", label: "Completed", count: taskCounts.completed },
    ],
    [taskCounts, activeFilter],
  );

  const completionStats = useMemo(() => {
    let completedToday = 0;
    let totalToday = 0;

    bucketTasks.forEach((task) => {
      const dueDate = parseDueDate(task);
      if (dueDate && isToday(dueDate)) {
        totalToday += 1;
        if (task.completed) {
          completedToday += 1;
        }
      }
    });

    return { completed: completedToday, total: totalToday };
  }, [bucketTasks]);

  const filteredTasks = useMemo(() => {
    const base = (() => {
      if (activeFilter === "completed") {
        return completedTasks;
      }
      if (activeFilter === "due-soon") {
        return openTasks.filter((task) => isDueSoonTask(task));
      }
      if (activeFilter === "overdue") {
        return openTasks.filter((task) => isOverdueTask(task));
      }
      return openTasks;
    })();

    return base.slice().sort((a, b) => {
      const dueA = parseDueDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const dueB = parseDueDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (dueA !== dueB) {
        return dueA - dueB;
      }
      return a.content.localeCompare(b.content);
    });
  }, [activeFilter, completedTasks, openTasks]);

  const handleQuickAdd = async (taskContent: string) => {
    try {
      // Match the Tasks page behavior: quick-add creates an open task unless user explicitly schedules it.
      await createTask(taskContent, null, undefined, activeBucket || undefined);
      setActiveFilter("open");
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  const handleToggleCompletion = async (task: Task) => {
    const taskId = task.id.toString();
    const wasCompleted = task.completed;
    setUpdatingCompletion((prev) => new Set(prev).add(taskId));
    try {
      await toggleTaskCompletion(task.id);
      toast({
        title: wasCompleted ? "Task reopened" : "Task completed",
        type: "success",
        duration: 2500,
      });
    } catch (error) {
      console.error("Failed to toggle task completion:", error);
      toast({
        title: "Failed to update task",
        type: "error",
      });
    } finally {
      setUpdatingCompletion((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const renderTask = (task: Task) => {
    const taskId = task.id.toString();
    const linkedInfo = linkedMap[taskId];
    const isTogglingWidget = togglingTaskId === taskId;
    const isUpdating = updatingCompletion.has(taskId);
    const dueBadge = getDueBadge(task);

    const onToggleOverview = async (
      event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      if (!onToggleTaskWidget) return;

      setTogglingTaskId(taskId);
      try {
        await onToggleTaskWidget(task);
      } catch (error) {
        console.error("Failed to toggle overview link:", error);
      } finally {
        setTogglingTaskId((current) => (current === taskId ? null : current));
      }
    };

    return (
      <div
        className="group p-4 transition-colors hover:bg-[rgba(250,248,245,0.5)] cursor-pointer"
        onClick={() => onEditTask?.(taskId)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEditTask?.(taskId); } }}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={Boolean(task.completed)}
            onChange={() => void handleToggleCompletion(task)}
            onClick={(e) => e.stopPropagation()}
            disabled={isUpdating}
            className="mt-0.5 h-4 w-4 rounded border-theme-neutral-300 text-theme-primary focus:ring-theme-focus/30 disabled:cursor-not-allowed disabled:opacity-60"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4
                className={`text-sm font-medium ${
                  task.completed
                    ? "text-theme-text-tertiary line-through"
                    : "text-theme-text-primary"
                }`}
              >
                {task.content}
              </h4>
              <div className="flex items-center gap-1.5 shrink-0">
                {onEditTask ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEditTask(taskId); }}
                    className="rounded-full border border-transparent p-1 text-theme-text-tertiary opacity-0 transition-all group-hover:opacity-100 hover:border-theme-neutral-300 hover:bg-theme-surface-alt hover:text-theme-text-primary"
                    title="Edit task"
                    aria-label="Edit task"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {onToggleTaskWidget ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void onToggleOverview(e); }}
                    disabled={isTogglingWidget}
                    className={`rounded-full border px-2 py-1 text-xs font-medium transition-colors ${
                      linkedInfo
                        ? "border-theme-primary/40 bg-theme-brand-tint-light text-theme-primary hover:bg-theme-primary/20"
                        : "border-theme-neutral-300 text-theme-text-tertiary hover:bg-theme-surface-alt"
                    } ${isTogglingWidget ? "cursor-progress opacity-60" : ""}`}
                    title={linkedInfo ? "Remove from overview" : "Show on overview"}
                  >
                    <span className="flex items-center gap-1">
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      {linkedInfo ? "On overview" : "To overview"}
                    </span>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {dueBadge ? (
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${dueBadgeClasses[dueBadge.tone]}`}
                >
                  {dueBadge.label}
                </span>
              ) : null}

              {linkedInfo ? (
                <span className="text-xs text-theme-primary/90">
                  Showing on overview ({linkedInfo.bucket})
                </span>
              ) : null}

              {isUpdating ? (
                <span className="text-xs text-theme-text-tertiary">Updating...</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const bucketLabel = activeBucket || "Life";
  const showMarketingEmpty = bucketTasks.length === 0;
  const hasOpenTasks = openTasks.length > 0;
  const hasCompletedTasks = completedTasks.length > 0;

  const emptyStateCopy = useMemo(() => {
    if (activeFilter === "completed") {
      return {
        title: "No completed tasks yet",
        description: hasOpenTasks
          ? "Complete a task to see it here."
          : "Add a task to start building momentum.",
      };
    }

    if (activeFilter === "due-soon") {
      return {
        title: "Nothing due soon",
        description: hasOpenTasks
          ? "You have no deadlines in the next three days."
          : "Add a task to start planning this bucket.",
      };
    }

    if (activeFilter === "overdue") {
      return {
        title: "No overdue tasks",
        description: hasOpenTasks
          ? "Everything here is on track."
          : "Add a task to start planning this bucket.",
      };
    }

    return {
      title: hasOpenTasks ? "No tasks match this filter" : "No open tasks",
      description: hasOpenTasks
        ? "Try a different filter."
        : hasCompletedTasks
          ? "Great work. Reopen a completed task or add a new one."
          : "Add your first task using quick add.",
    };
  }, [activeFilter, hasCompletedTasks, hasOpenTasks]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-theme-text-primary">Tasks for {bucketLabel}</h2>
          <p className="mt-1 text-sm text-theme-text-tertiary">
            {taskCounts.open} open · {taskCounts.dueSoon} due soon · {taskCounts.completed} completed
            {buckets.length > 1 ? ` · ${buckets.length} buckets` : ""}
          </p>
        </div>
        <Link
          href="/tasks"
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-theme-neutral-300/80 bg-white px-3 text-sm font-medium text-theme-text-secondary shadow-sm transition-all duration-200 ease-out hover:bg-theme-surface-alt hover:text-theme-text-primary hover:shadow-warm"
        >
          Open full board
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <TasksQuickActions
        onQuickAdd={handleQuickAdd}
        filters={quickFilters}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        quickAddPlaceholder={`Add a task to ${bucketLabel}...`}
      />

      {completionStats.total > 0 && (
        <TasksDailyProgress
          completedToday={completionStats.completed}
          totalToday={completionStats.total}
          streakDays={0}
        />
      )}

      {showMarketingEmpty ? (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-theme-brand-tint-light">
            <ListChecks className="h-8 w-8 text-theme-primary" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-theme-text-primary">
            Add tasks to {bucketLabel}
          </h3>
          <p className="mb-6 max-w-md text-sm text-theme-text-tertiary">
            Connect Todoist for automatic sync, or add tasks manually with quick add.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/integrations";
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-theme-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-theme-primary-600"
            >
              <Zap className="h-4 w-4" />
              Connect Todoist
            </button>
            <Link
              href="/tasks"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-theme-neutral-300/80 bg-white px-5 py-2.5 text-sm font-medium text-theme-text-primary transition-colors hover:bg-theme-surface-alt"
            >
              <ExternalLink className="h-4 w-4" />
              Open task board
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-theme-neutral-300/80 bg-white">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-theme-text-tertiary">
              <p className="mb-2 text-lg font-medium text-theme-text-primary">
                {emptyStateCopy.title}
              </p>
              <p className="text-sm">{emptyStateCopy.description}</p>
            </div>
          ) : activeFilter === "open" ? (
            <div className="p-6">
              <TasksGroupedList tasks={filteredTasks} renderTask={renderTask} />
            </div>
          ) : (
            <div className="divide-y divide-theme-neutral-300/60">
              {filteredTasks.map((task) => (
                <div key={task.id}>{renderTask(task)}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
