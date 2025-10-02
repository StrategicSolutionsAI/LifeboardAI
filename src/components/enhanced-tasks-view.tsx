"use client";

import React, { useState, useMemo } from "react";
import { useTasksContext } from "@/contexts/tasks-context";
import { TasksQuickActions } from "./tasks-quick-actions";
import { TasksGroupedList } from "./tasks-grouped-list";
import { TasksDailyProgress } from "./tasks-daily-progress";
import { CalendarTaskList } from "./calendar-task-list";
import { isToday, isPast, parseISO } from "date-fns";
import type { Task } from "@/hooks/use-tasks";

interface EnhancedTasksViewProps {
  activeBucket: string;
  buckets: string[];
}

export function EnhancedTasksView({ activeBucket, buckets }: EnhancedTasksViewProps) {
  const { scheduledTasks, dailyVisibleTasks, createTask } = useTasksContext();
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Combine all tasks
  const allTasks = useMemo(() => {
    return [...scheduledTasks, ...dailyVisibleTasks];
  }, [scheduledTasks, dailyVisibleTasks]);

  // Calculate task counts for filters
  const taskCounts = useMemo(() => {
    const now = new Date();
    let today = 0;
    let overdue = 0;
    let highPriority = 0;

    allTasks.forEach((task) => {
      if (task.completed) return;

      // Today count
      if (task.due?.date) {
        try {
          const dueDate = parseISO(task.due.date);
          if (isToday(dueDate)) today++;
          if (isPast(dueDate) && !isToday(dueDate)) overdue++;
        } catch (e) {
          // Invalid date
        }
      }

      // High priority count (Todoist tasks may have priority)
      const priority = (task as any).priority?.toString().toLowerCase();
      if (priority === 'high' || priority === '3' || priority === 'critical' || priority === '4') {
        highPriority++;
      }
    });

    return {
      all: allTasks.filter(t => !t.completed).length,
      today,
      overdue,
      highPriority,
    };
  }, [allTasks]);

  // Filter tasks based on active filter
  const filteredTasks = useMemo(() => {
    if (activeFilter === "all") {
      return allTasks.filter(t => !t.completed);
    }

    if (activeFilter === "today") {
      return allTasks.filter((task) => {
        if (task.completed) return false;
        if (!task.due?.date) return false;
        try {
          const dueDate = parseISO(task.due.date);
          return isToday(dueDate);
        } catch (e) {
          return false;
        }
      });
    }

    if (activeFilter === "overdue") {
      return allTasks.filter((task) => {
        if (task.completed) return false;
        if (!task.due?.date) return false;
        try {
          const dueDate = parseISO(task.due.date);
          return isPast(dueDate) && !isToday(dueDate);
        } catch (e) {
          return false;
        }
      });
    }

    if (activeFilter === "high-priority") {
      return allTasks.filter((task) => {
        if (task.completed) return false;
        const priority = (task as any).priority?.toString().toLowerCase();
        return priority === 'high' || priority === '3' || priority === 'critical' || priority === '4';
      });
    }

    return allTasks.filter(t => !t.completed);
  }, [allTasks, activeFilter]);

  // Calculate completion stats for today
  const completionStats = useMemo(() => {
    const todayTasks = allTasks.filter((task) => {
      if (!task.due?.date) return false;
      try {
        const dueDate = parseISO(task.due.date);
        return isToday(dueDate);
      } catch (e) {
        return false;
      }
    });

    const completed = todayTasks.filter(t => t.completed).length;
    const total = todayTasks.length;

    return { completed, total };
  }, [allTasks]);

  const handleQuickAdd = async (taskContent: string) => {
    try {
      // Format today's date as YYYY-MM-DD
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      await createTask(taskContent, dateStr);
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  // Simple task renderer for grouped list
  const renderTask = (task: any, index: number) => {
    return (
      <div className="p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={task.completed || false}
            onChange={() => {
              // Task completion will be handled by CalendarTaskList
            }}
            className="mt-1 w-5 h-5 rounded border-gray-300 cursor-pointer"
          />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900">{task.content}</h4>
            {task.due?.date && (
              <p className="text-xs text-gray-500 mt-1">
                Due: {new Date(task.due.date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Quick Actions Bar */}
      <TasksQuickActions
        onQuickAdd={handleQuickAdd}
        taskCounts={taskCounts}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* Daily Progress */}
      {taskCounts.today > 0 && (
        <TasksDailyProgress
          completedToday={completionStats.completed}
          totalToday={completionStats.total}
          streakDays={0}
        />
      )}

      {/* Tasks Content */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No tasks found</p>
          <p className="text-sm">
            {activeFilter !== "all" 
              ? "Try changing your filter or add a new task above."
              : "Add your first task using the quick add bar above."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          {activeFilter === "all" ? (
            // Use grouped view for "all" filter
            <div className="p-6">
              <TasksGroupedList
                tasks={filteredTasks}
                renderTask={renderTask}
              />
            </div>
          ) : (
            // Use flat list for filtered views
            <div className="divide-y divide-gray-100">
              {filteredTasks.map((task, index) => (
                <div key={task.id}>
                  {renderTask(task, index)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full CalendarTaskList in a collapsible section for advanced features */}
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
