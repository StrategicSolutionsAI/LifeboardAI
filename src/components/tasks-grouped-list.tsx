"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { isToday, isThisWeek, isPast, startOfDay, parseISO } from "date-fns";

interface Task {
  id: string;
  content: string;
  due?: { date?: string } | null;
  priority?: string | number;
  completed?: boolean;
}

interface TasksGroupedListProps {
  tasks: Task[];
  renderTask: (task: Task, index: number) => React.ReactNode;
}

interface TaskGroup {
  title: string;
  emoji: string;
  color: string;
  tasks: Task[];
  defaultCollapsed: boolean;
}

export function TasksGroupedList({ tasks, renderTask }: TasksGroupedListProps) {
  const groups = useMemo(() => {
    const overdue: Task[] = [];
    const today: Task[] = [];
    const thisWeek: Task[] = [];
    const later: Task[] = [];
    const noDueDate: Task[] = [];

    const now = new Date();

    tasks.forEach((task) => {
      if (task.completed) return; // Skip completed tasks

      if (!task.due?.date) {
        noDueDate.push(task);
        return;
      }

      try {
        const dueDate = parseISO(task.due.date);
        
        if (isPast(dueDate) && !isToday(dueDate)) {
          overdue.push(task);
        } else if (isToday(dueDate)) {
          today.push(task);
        } else if (isThisWeek(dueDate, { weekStartsOn: 0 })) {
          thisWeek.push(task);
        } else {
          later.push(task);
        }
      } catch (e) {
        // If date parsing fails, put in no due date
        noDueDate.push(task);
      }
    });

    const result: TaskGroup[] = [];
    
    if (overdue.length > 0) {
      result.push({
        title: "Overdue",
        emoji: "⚠️",
        color: "red",
        tasks: overdue,
        defaultCollapsed: false,
      });
    }
    
    if (today.length > 0) {
      result.push({
        title: "Today",
        emoji: "⭐",
        color: "blue",
        tasks: today,
        defaultCollapsed: false,
      });
    }
    
    if (thisWeek.length > 0) {
      result.push({
        title: "This Week",
        emoji: "📅",
        color: "green",
        tasks: thisWeek,
        defaultCollapsed: false,
      });
    }
    
    if (later.length > 0) {
      result.push({
        title: "Later",
        emoji: "🗓️",
        color: "gray",
        tasks: later,
        defaultCollapsed: true,
      });
    }
    
    if (noDueDate.length > 0) {
      result.push({
        title: "No Due Date",
        emoji: "📝",
        color: "gray",
        tasks: noDueDate,
        defaultCollapsed: true,
      });
    }

    return result;
  }, [tasks]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    return new Set(groups.filter(g => g.defaultCollapsed).map(g => g.title));
  });

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const getGroupStyles = (color: string) => {
    const styles = {
      red: "bg-red-50 border-red-200 text-red-700",
      blue: "bg-blue-50 border-blue-200 text-blue-700",
      green: "bg-green-50 border-green-200 text-green-700",
      gray: "bg-gray-50 border-gray-200 text-gray-700",
    };
    return styles[color as keyof typeof styles] || styles.gray;
  };

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg mb-2">🎉 All caught up!</p>
        <p className="text-sm">You have no pending tasks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isCollapsed = collapsedGroups.has(group.title);
        
        return (
          <div key={group.title} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.title)}
              className={`w-full flex items-center justify-between p-4 font-medium transition-colors hover:bg-gray-50 ${getGroupStyles(group.color)}`}
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                <span>
                  {group.emoji} {group.title}
                </span>
                <span className="text-sm opacity-75">({group.tasks.length})</span>
              </div>
            </button>

            {/* Group Tasks */}
            {!isCollapsed && (
              <div className="divide-y divide-gray-100 bg-white">
                {group.tasks.map((task, index) => (
                  <div key={task.id}>{renderTask(task, index)}</div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
