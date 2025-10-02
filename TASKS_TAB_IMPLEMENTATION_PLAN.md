# Tasks Tab Implementation Plan

## Phase 1: Quick Wins (Implement This Week)

### 1. Enhanced Empty State (30 min)
**File:** `/src/components/taskboard-dashboard.tsx`
**Line:** ~3584

```tsx
{activeSubTab === 'Tasks' && (
  <div>
    {/* Tasks Header */}
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-semibold">Tasks for {activeBucket}</h2>
    </div>
    
    {/* Enhanced Empty State */}
    {!activeBucket || activeWidgets.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
          <ListChecks className="h-10 w-10 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Organize Your {activeBucket || 'Life'} Tasks
        </h3>
        <p className="text-sm text-gray-500 text-center max-w-md mb-6">
          Connect your Todoist account to sync tasks automatically, or start adding tasks manually. 
          Keep everything organized by bucket.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={() => window.location.href = '/integrations'}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
          >
            <Zap className="h-5 w-5" />
            Connect Todoist
          </button>
          <button className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">
            View Tutorial
          </button>
        </div>
        
        {/* Feature highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-3xl">
          <div className="text-center p-4">
            <Calendar className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900 mb-1">Due Dates</h4>
            <p className="text-xs text-gray-500">Schedule tasks with smart date parsing</p>
          </div>
          <div className="text-center p-4">
            <Flag className="h-8 w-8 text-orange-600 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900 mb-1">Priorities</h4>
            <p className="text-xs text-gray-500">Mark critical tasks to focus on what matters</p>
          </div>
          <div className="text-center p-4">
            <Target className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900 mb-1">Bucket Tags</h4>
            <p className="text-xs text-gray-500">Auto-tag tasks with your current bucket</p>
          </div>
        </div>
      </div>
    ) : (
      <TasksProvider selectedDate={new Date()}>
        {/* Existing tasks content */}
      </TasksProvider>
    )}
  </div>
)}
```

### 2. Quick Action Bar (1 hour)
**Create new component:** `/src/components/tasks-quick-actions.tsx`

```tsx
"use client";

import React, { useState } from "react";
import { Plus, Filter, SortAsc } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TasksQuickActionsProps {
  onQuickAdd: (taskContent: string) => void;
  taskCounts: {
    all: number;
    today: number;
    overdue: number;
    highPriority: number;
  };
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export function TasksQuickActions({
  onQuickAdd,
  taskCounts,
  activeFilter,
  onFilterChange,
}: TasksQuickActionsProps) {
  const [quickAddInput, setQuickAddInput] = useState("");

  const handleQuickAdd = () => {
    if (quickAddInput.trim()) {
      onQuickAdd(quickAddInput.trim());
      setQuickAddInput("");
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 p-4 mb-6 shadow-sm">
      {/* Quick Add Input */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={quickAddInput}
          onChange={(e) => setQuickAddInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleQuickAdd();
            }
          }}
          placeholder="Quick add task... (e.g., 'Buy groceries tomorrow')"
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <button
          onClick={handleQuickAdd}
          disabled={!quickAddInput.trim()}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
      </div>

      {/* Quick Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant={activeFilter === "all" ? "default" : "outline"}
          className="cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onFilterChange("all")}
        >
          All Tasks ({taskCounts.all})
        </Badge>
        <Badge
          variant={activeFilter === "today" ? "default" : "outline"}
          className="cursor-pointer hover:bg-blue-50 transition-colors"
          onClick={() => onFilterChange("today")}
        >
          Today ({taskCounts.today})
        </Badge>
        {taskCounts.overdue > 0 && (
          <Badge
            variant={activeFilter === "overdue" ? "destructive" : "outline"}
            className="cursor-pointer hover:bg-red-50 transition-colors"
            onClick={() => onFilterChange("overdue")}
          >
            ⚠️ Overdue ({taskCounts.overdue})
          </Badge>
        )}
        <Badge
          variant={activeFilter === "high-priority" ? "default" : "outline"}
          className="cursor-pointer hover:bg-orange-50 transition-colors"
          onClick={() => onFilterChange("high-priority")}
        >
          High Priority ({taskCounts.highPriority})
        </Badge>
      </div>
    </div>
  );
}
```

### 3. Task Grouping (2 hours)
**Create new component:** `/src/components/tasks-grouped-list.tsx`

```tsx
"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { format, isToday, isTomorrow, isThisWeek, isPast, startOfDay } from "date-fns";

interface Task {
  id: string;
  content: string;
  due?: { date: string };
  priority?: string;
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

    const now = startOfDay(new Date());

    tasks.forEach((task) => {
      if (task.completed) return; // Skip completed tasks

      if (!task.due?.date) {
        noDueDate.push(task);
        return;
      }

      const dueDate = new Date(task.due.date);
      
      if (isPast(dueDate) && !isToday(dueDate)) {
        overdue.push(task);
      } else if (isToday(dueDate)) {
        today.push(task);
      } else if (isThisWeek(dueDate)) {
        thisWeek.push(task);
      } else {
        later.push(task);
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
```

### 4. Daily Progress Indicator (30 min)
**Create new component:** `/src/components/tasks-daily-progress.tsx`

```tsx
"use client";

import React from "react";
import { CheckCircle2, Circle } from "lucide-react";

interface TasksDailyProgressProps {
  completedToday: number;
  totalToday: number;
  streakDays?: number;
}

export function TasksDailyProgress({
  completedToday,
  totalToday,
  streakDays = 0,
}: TasksDailyProgressProps) {
  const percentage = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  
  return (
    <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 via-blue-100 to-blue-50 rounded-xl border border-blue-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-gray-900">Today's Progress</span>
        </div>
        {streakDays > 0 && (
          <div className="flex items-center gap-1 px-3 py-1 bg-orange-100 rounded-full">
            <span className="text-lg">🔥</span>
            <span className="text-sm font-medium text-orange-700">{streakDays} day streak</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-blue-700">
          {completedToday} of {totalToday} tasks completed
        </span>
        <span className="text-sm font-bold text-blue-700">{percentage}%</span>
      </div>
      
      <div className="w-full bg-white/60 rounded-full h-3 overflow-hidden shadow-inner">
        <div
          className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-700 ease-out shadow-sm"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {percentage === 100 && totalToday > 0 && (
        <p className="text-sm text-blue-700 mt-3 font-medium text-center">
          🎉 Amazing! You've completed all your tasks for today!
        </p>
      )}
    </div>
  );
}
```

---

## Phase 2: Enhanced Visual Design (Next Week)

### 5. Enhanced Task Card Component
**Update:** `/src/components/calendar-task-list.tsx` EnhancedTaskCard

Add these visual improvements:
- Stronger left border (4px → 6px)
- Subtle gradient backgrounds
- Better hover states
- Quick actions on hover
- Better spacing and typography

### 6. Add Keyboard Shortcuts
**Create:** `/src/hooks/use-task-shortcuts.ts`

```tsx
import { useEffect } from "react";

export function useTaskShortcuts(handlers: {
  onNewTask?: () => void;
  onToggleComplete?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          handlers.onNewTask?.();
          break;
        case " ":
          e.preventDefault();
          handlers.onToggleComplete?.();
          break;
        case "arrowup":
          e.preventDefault();
          handlers.onNavigateUp?.();
          break;
        case "arrowdown":
          e.preventDefault();
          handlers.onNavigateDown?.();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
```

---

## Phase 3: Advanced Features (Later)

### 7. Bulk Actions
### 8. Task Templates
### 9. Smart Suggestions
### 10. Advanced Filters

---

## Integration Steps

1. **Update taskboard-dashboard.tsx:**
   - Import new components
   - Replace Tasks tab content
   - Add state for filters and groups

2. **Update CalendarTaskList:**
   - Pass through filter props
   - Support grouped rendering
   - Enhance visual styling

3. **Update use-tasks hook:**
   - Add computed properties for task counts
   - Add filter methods
   - Add completion tracking

4. **Test Integration:**
   - Test empty state flows
   - Test quick add functionality
   - Test grouping and filters
   - Test progress tracking

---

## Testing Checklist

- [ ] Empty state shows when no tasks
- [ ] Quick add works with Enter key
- [ ] Filters update task list correctly
- [ ] Groups collapse/expand
- [ ] Progress bar updates when tasks completed
- [ ] All existing drag-drop functionality still works
- [ ] Mobile responsive
- [ ] Keyboard navigation works
- [ ] No performance regressions

---

## Rollout Strategy

**Week 1: Quick Wins**
- Deploy empty state
- Deploy quick action bar
- Deploy task grouping
- Deploy progress indicator

**Week 2: Visual Polish**
- Enhanced task cards
- Better animations
- Keyboard shortcuts
- Mobile optimization

**Week 3: Advanced**
- Bulk actions
- Templates
- Smart features

**Metrics to Track:**
- Task completion rate
- Time spent on Tasks tab
- Number of tasks created
- User satisfaction feedback
