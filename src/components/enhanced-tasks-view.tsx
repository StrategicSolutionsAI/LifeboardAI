"use client";

import React, { useState, useMemo } from "react";
import { useTasksContext } from "@/contexts/tasks-context";
import { TasksQuickActions } from "./tasks-quick-actions";
import { TasksGroupedList } from "./tasks-grouped-list";
import { TasksDailyProgress } from "./tasks-daily-progress";
import { CalendarTaskList } from "./calendar-task-list";
import { isToday, isPast, parseISO } from "date-fns";
import type { Task } from "@/hooks/use-tasks";
import {
  ListChecks,
  Zap,
  Calendar as CalendarIcon,
  Flag,
  Target,
} from "lucide-react";

interface EnhancedTasksViewProps {
  activeBucket: string;
  buckets: string[];
}

const parseDueDate = (task: Task): Date | null => {
  const raw = task.due?.date ?? task.due?.datetime ?? null;
  if (!raw) return null;

  try {
    if (raw.length === 10) {
      return parseISO(`${raw}T00:00:00`);
    }
    return parseISO(raw);
  } catch {
    return null;
  }
};

export function EnhancedTasksView({
  activeBucket,
  buckets,
}: EnhancedTasksViewProps) {
  const { allTasks, createTask, toggleTaskCompletion } = useTasksContext();
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const bucketTasks = useMemo(() => {
    const tasks = Array.isArray(allTasks) ? allTasks : [];
    const seen = new Set<string>();
    const normalize = (value?: string | null) =>
      (value ?? "").trim().toLowerCase();
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

  const taskCounts = useMemo(() => {
    let today = 0;
    let overdue = 0;
    let highPriority = 0;

    openTasks.forEach((task) => {
      const dueDate = parseDueDate(task);
      if (dueDate) {
        if (isToday(dueDate)) {
          today += 1;
        } else if (isPast(dueDate)) {
          overdue += 1;
        }
      }

      const priority = (task as any).priority?.toString().toLowerCase();
      if (
        priority === "high" ||
        priority === "3" ||
        priority === "critical" ||
        priority === "4"
      ) {
        highPriority += 1;
      }
    });

    return {
      all: openTasks.length,
      today,
      overdue,
      highPriority,
    };
  }, [openTasks]);

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
      if (activeFilter === "all") {
        return openTasks;
      }

      if (activeFilter === "today") {
        return openTasks.filter((task) => {
          const dueDate = parseDueDate(task);
          return dueDate ? isToday(dueDate) : false;
        });
      }

      if (activeFilter === "overdue") {
        return openTasks.filter((task) => {
          const dueDate = parseDueDate(task);
          return dueDate ? isPast(dueDate) && !isToday(dueDate) : false;
        });
      }

      if (activeFilter === "high-priority") {
        return openTasks.filter((task) => {
          const priority = (task as any).priority?.toString().toLowerCase();
          return (
            priority === "high" ||
            priority === "3" ||
            priority === "critical" ||
            priority === "4"
          );
        });
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
  }, [openTasks, activeFilter]);

  const handleQuickAdd = async (taskContent: string) => {
    try {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      await createTask(taskContent, dateStr, undefined, activeBucket || undefined);
      setActiveFilter("all");
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  const renderTask = (task: Task) => {
    const dueDate = parseDueDate(task);
    const isOverdue = dueDate ? isPast(dueDate) && !isToday(dueDate) : false;
    const isDueToday = dueDate ? isToday(dueDate) : false;

    return (
      <div className="p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={Boolean(task.completed)}
            onChange={() => void toggleTaskCompletion(task.id)}
            className="mt-1 w-5 h-5 rounded border-gray-300 cursor-pointer accent-blue-600"
          />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900">{task.content}</h4>
            {dueDate && (
              <p
                className={`text-xs mt-1 ${
                  isOverdue
                    ? "text-red-600"
                    : isDueToday
                      ? "text-blue-600"
                      : "text-gray-500"
                }`}
              >
                {isOverdue ? "Overdue · " : ""}
                Due: {dueDate.toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const bucketLabel = activeBucket || "Life";
  const showMarketingEmpty = bucketTasks.length === 0 && activeFilter === "all";
  const hasOpenTasks = openTasks.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">
          Tasks for {bucketLabel}
        </h2>
      </div>

      <TasksQuickActions
        onQuickAdd={handleQuickAdd}
        taskCounts={taskCounts}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {completionStats.total > 0 && (
        <TasksDailyProgress
          completedToday={completionStats.completed}
          totalToday={completionStats.total}
          streakDays={0}
        />
      )}

      {showMarketingEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
            <ListChecks className="h-10 w-10 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Organize Your {bucketLabel} Tasks
          </h3>
          <p className="text-sm text-gray-500 max-w-md mb-6">
            Connect your Todoist account to sync tasks automatically, or start
            adding tasks manually. Keep everything organized by bucket.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/integrations";
                }
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2 justify-center"
            >
              <Zap className="h-5 w-5" />
              Connect Todoist
            </button>
            <button
              type="button"
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              View Tutorial
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full">
            <div className="text-center p-4">
              <CalendarIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <h4 className="font-medium text-gray-900 mb-1">Due Dates</h4>
              <p className="text-xs text-gray-500">
                Schedule tasks with smart date parsing
              </p>
            </div>
            <div className="text-center p-4">
              <Flag className="h-8 w-8 text-orange-600 mx-auto mb-2" />
              <h4 className="font-medium text-gray-900 mb-1">Priorities</h4>
              <p className="text-xs text-gray-500">
                Mark critical tasks to focus on what matters
              </p>
            </div>
            <div className="text-center p-4">
              <Target className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <h4 className="font-medium text-gray-900 mb-1">Bucket Tags</h4>
              <p className="text-xs text-gray-500">
                Auto-tag tasks with your current bucket
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">
                {hasOpenTasks ? "No tasks match this filter" : "🎉 All tasks complete"}
              </p>
              <p className="text-sm">
                {hasOpenTasks
                  ? "Try changing your filter or add a new task above."
                  : "Add your next task using the quick add bar above."}
              </p>
            </div>
          ) : activeFilter === "all" ? (
            <div className="p-6">
              <TasksGroupedList tasks={filteredTasks} renderTask={renderTask} />
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTasks.map((task) => (
                <div key={task.id}>{renderTask(task)}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <details className="mt-8">
        <summary className="cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors font-medium text-gray-700">
          📋 Advanced Task Management
        </summary>
        <div className="mt-4 bg-white rounded-lg border border-gray-200 p-6">
          <CalendarTaskList
            selectedDate={new Date()}
            availableBuckets={buckets}
            selectedBucket={activeBucket}
            dashboardView={true}
          />
        </div>
      </details>
    </div>
  );
}
