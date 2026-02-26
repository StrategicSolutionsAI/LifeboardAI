"use client";

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { isPast, isThisWeek, isToday, parseISO } from "date-fns";

interface Task {
  id: string;
  content: string;
  due?: { date?: string } | null;
  priority?: string | number;
  completed: boolean;
}

interface TasksGroupedListProps {
  tasks: Task[];
  renderTask: (task: Task, index: number) => React.ReactNode;
}

interface TaskGroup {
  key: string;
  title: string;
  tone: "critical" | "accent" | "success" | "neutral";
  tasks: Task[];
  defaultCollapsed: boolean;
}

const parseDueDate = (raw?: string): Date | null => {
  if (!raw) return null;
  try {
    const normalized = raw.length === 10 ? `${raw}T00:00:00` : raw;
    const parsed = parseISO(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
};

export function TasksGroupedList({ tasks, renderTask }: TasksGroupedListProps) {
  const groups = useMemo(() => {
    const overdue: Task[] = [];
    const today: Task[] = [];
    const thisWeek: Task[] = [];
    const later: Task[] = [];
    const noDueDate: Task[] = [];

    tasks.forEach((task) => {
      if (task.completed) return; // Skip completed tasks

      if (!task.due?.date) {
        noDueDate.push(task);
        return;
      }

      const dueDate = parseDueDate(task.due.date);
      if (!dueDate) {
        noDueDate.push(task);
        return;
      }

      if (isPast(dueDate) && !isToday(dueDate)) {
        overdue.push(task);
      } else if (isToday(dueDate)) {
        today.push(task);
      } else if (isThisWeek(dueDate, { weekStartsOn: 0 })) {
        thisWeek.push(task);
      } else {
        later.push(task);
      }
    });

    const result: TaskGroup[] = [];
    
    if (overdue.length > 0) {
      result.push({
        key: "overdue",
        title: "Overdue",
        tone: "critical",
        tasks: overdue,
        defaultCollapsed: false,
      });
    }
    
    if (today.length > 0) {
      result.push({
        key: "today",
        title: "Today",
        tone: "accent",
        tasks: today,
        defaultCollapsed: false,
      });
    }
    
    if (thisWeek.length > 0) {
      result.push({
        key: "this-week",
        title: "This Week",
        tone: "success",
        tasks: thisWeek,
        defaultCollapsed: false,
      });
    }
    
    if (later.length > 0) {
      result.push({
        key: "later",
        title: "Later",
        tone: "neutral",
        tasks: later,
        defaultCollapsed: true,
      });
    }
    
    if (noDueDate.length > 0) {
      result.push({
        key: "no-due-date",
        title: "No Due Date",
        tone: "neutral",
        tasks: noDueDate,
        defaultCollapsed: true,
      });
    }

    return result;
  }, [tasks]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    return new Set(groups.filter((g) => g.defaultCollapsed).map((g) => g.key));
  });

  useEffect(() => {
    const availableKeys = new Set(groups.map((group) => group.key));
    setCollapsedGroups((prev) => {
      const next = new Set<string>();
      prev.forEach((key) => {
        if (availableKeys.has(key)) {
          next.add(key);
        }
      });

      groups.forEach((group) => {
        if (group.defaultCollapsed && !prev.has(group.key)) {
          next.add(group.key);
        }
      });

      return next;
    });
  }, [groups]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  if (groups.length === 0) {
    return (
      <div className="py-12 text-center text-[#8e99a8]">
        <p className="mb-2 text-lg text-[#314158]">All caught up</p>
        <p className="text-sm">No open tasks in this section.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <GroupSection
          key={group.key}
          group={group}
          isCollapsed={collapsedGroups.has(group.key)}
          onToggle={toggleGroup}
          renderTask={renderTask}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Memoized group section — collapsing one group won't re-render the others.
// ---------------------------------------------------------------------------
const TONE_STYLES: Record<TaskGroup["tone"], string> = {
  critical: "border-red-200/70 bg-red-50/60 text-red-700",
  accent: "border-[#dbd6cf]/70 bg-[#fdf8f6]/60 text-[#9a7b5a]",
  success: "border-emerald-200/70 bg-emerald-50/60 text-emerald-700",
  neutral: "border-[#dbd6cf]/70 bg-[rgba(250,248,245,0.4)] text-[#8e99a8]",
};

const GroupSection = memo(function GroupSection({
  group,
  isCollapsed,
  onToggle,
  renderTask,
}: {
  group: TaskGroup;
  isCollapsed: boolean;
  onToggle: (key: string) => void;
  renderTask: (task: Task, index: number) => React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#dbd6cf]/70">
      <button
        onClick={() => onToggle(group.key)}
        className={`flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors ${TONE_STYLES[group.tone]}`}
      >
        <div className="flex items-center gap-2">
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span>{group.title}</span>
        </div>
        <div className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/70 px-2 text-xs font-semibold text-[#314158]">
          {group.tasks.length}
        </div>
      </button>

      {!isCollapsed && (
        <div className="divide-y divide-[#dbd6cf]/60 bg-white">
          {group.tasks.map((task, index) => (
            <div key={task.id}>{renderTask(task, index)}</div>
          ))}
        </div>
      )}
    </div>
  );
});
