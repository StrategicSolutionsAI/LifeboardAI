"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { SidebarLayout } from "@/components/sidebar-layout";
import { TasksProvider, useTasksContext } from "@/contexts/tasks-context";
import { useBuckets } from "@/hooks/use-buckets";
import type { Bucket as BoardBucket, Task as BoardTask } from "@/components/TasksBoard";
import type { TaskEditorModalHandle } from "@/components/task-editor-modal";
import type { ListTask } from "@/components/task-list-view";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { differenceInCalendarDays, parseISO, isValid, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Plus, ListTodo, Search } from "lucide-react";
import { getBucketColorSync, UNASSIGNED_BUCKET_ID } from "@/lib/bucket-colors";
import { getUserPreferencesClient } from "@/lib/user-preferences";
import { useToast, ToastProvider } from "@/components/ui/use-toast";
import { TaskBoardTabs, type TaskTabId } from "@/components/task-board-tabs";
import { type TaskFilterState, type TaskSortOption, defaultTaskFilters } from "@/components/task-filter-panel";

const TasksBoard = dynamic(() => import("@/components/TasksBoard"), {
  ssr: false,
  loading: () => (
    <div className="h-full rounded-xl border border-[#dbd6cf] bg-white p-4">
      <div className="h-full animate-pulse rounded-lg bg-[rgba(177,145,106,0.05)]" />
    </div>
  ),
});

const TaskListView = dynamic(
  () => import("@/components/task-list-view").then((m) => ({ default: m.TaskListView })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-[#dbd6cf] bg-white p-4">
        <div className="h-64 animate-pulse rounded-lg bg-[rgba(177,145,106,0.05)]" />
      </div>
    ),
  }
);

const TaskEditorModal = dynamic(() => import("@/components/task-editor-modal"), {
  ssr: false,
});

const UNASSIGNED_BUCKET_LABEL = "Unsorted";

function normalizeBucketId(name?: string | null) {
  const trimmed = (name ?? "").trim();
  return trimmed.length > 0 ? trimmed : UNASSIGNED_BUCKET_ID;
}

function isDueSoon(due?: string | null) {
  if (!due) return false;
  let parsed: Date;
  try {
    parsed = due.length === 10 ? parseISO(`${due}T00:00:00`) : parseISO(due);
  } catch {
    return false;
  }
  if (!isValid(parsed)) return false;
  const diff = differenceInCalendarDays(parsed, new Date());
  return diff >= 0 && diff <= 3;
}

function matchesDateFilter(
  dueDate?: string | null,
  preset?: TaskFilterState["dueDateRange"]
): boolean {
  if (!preset) return true;
  if (!dueDate) return false;

  let parsed: Date;
  try {
    parsed = dueDate.length === 10 ? parseISO(`${dueDate}T00:00:00`) : parseISO(dueDate);
  } catch {
    return false;
  }
  if (!isValid(parsed)) return false;

  const today = new Date();
  const diff = differenceInCalendarDays(parsed, today);

  switch (preset) {
    case "overdue":
      return diff < 0;
    case "today":
      return diff === 0;
    case "this-week": {
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      return parsed >= weekStart && parsed <= weekEnd;
    }
    case "this-month": {
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);
      return parsed >= monthStart && parsed <= monthEnd;
    }
    default:
      return true;
  }
}

function TasksBoardShell() {
  const { allTasks, toggleTaskCompletion, createTask, batchUpdateTasks, deleteTask } =
    useTasksContext();
  const { buckets } = useBuckets();
  const { toast } = useToast();
  const [bucketColors, setBucketColors] = useState<Record<string, string>>({});
  const [quickTask, setQuickTask] = useState("");
  const [quickBucket, setQuickBucket] = useState<string>(buckets[0] ?? "");
  const [activeTab, setActiveTab] = useState<TaskTabId>("lists");
  const [filters, setFilters] = useState<TaskFilterState>(defaultTaskFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const quickAddInputRef = useRef<HTMLInputElement>(null);
  const taskEditorRef = useRef<TaskEditorModalHandle | null>(null);

  useEffect(() => {
    if (!quickBucket && buckets.length > 0) {
      setQuickBucket(buckets[0]);
    }
  }, [buckets, quickBucket]);

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
  }, []);

  // Apply filters and search
  const filteredTasks = useMemo(() => {
    let result = [...allTasks];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.content.toLowerCase().includes(q) ||
          (t.bucket ?? "").toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filters.status === "open") {
      result = result.filter((t) => !t.completed);
    } else if (filters.status === "completed") {
      result = result.filter((t) => t.completed);
    }

    // Bucket filter
    if (filters.buckets.length > 0) {
      result = result.filter((t) =>
        filters.buckets.includes(t.bucket ?? UNASSIGNED_BUCKET_LABEL)
      );
    }

    // Due date filter
    if (filters.dueDateRange) {
      result = result.filter((t) =>
        matchesDateFilter(t.due?.date ?? null, filters.dueDateRange)
      );
    }

    // Sort
    if (filters.sortBy !== "manual") {
      const dir = filters.sortDirection === "asc" ? 1 : -1;
      result.sort((a, b) => {
        switch (filters.sortBy) {
          case "name":
            return dir * a.content.localeCompare(b.content);
          case "dueDate": {
            const aDate = a.due?.date ?? "";
            const bDate = b.due?.date ?? "";
            if (!aDate && !bDate) return 0;
            if (!aDate) return dir;
            if (!bDate) return -dir;
            return dir * aDate.localeCompare(bDate);
          }
          case "bucket": {
            const aBucket = a.bucket ?? "";
            const bBucket = b.bucket ?? "";
            return dir * aBucket.localeCompare(bBucket);
          }
          default:
            return 0;
        }
      });
    }

    return result;
  }, [allTasks, searchQuery, filters]);

  const openTasks = useMemo(() => allTasks.filter((t) => !t.completed), [allTasks]);
  const completedTasks = useMemo(() => allTasks.filter((t) => t.completed), [allTasks]);
  const totalOpen = openTasks.length;
  const totalCompleted = completedTasks.length;

  // Board view data (uses filtered tasks)
  const boardFilteredTasks = useMemo(() => {
    // For board view, respect filters except status (board shows based on viewMode)
    return filteredTasks.filter((t) => !t.completed);
  }, [filteredTasks]);

  const boardTasks: BoardTask[] = useMemo(() => {
    return boardFilteredTasks.map((t) => ({
      id: t.id.toString(),
      title: t.content,
      bucketId: normalizeBucketId(t.bucket),
      status: t.completed ? "done" : "open",
      position: typeof t.position === "number" ? t.position : null,
      dueDate: t.due?.date ?? null,
      startDate: t.startDate ?? null,
      endDate: t.endDate ?? null,
      createdAt: t.created_at ?? null,
      due: t.due,
    }));
  }, [boardFilteredTasks]);

  const boardBuckets: BoardBucket[] = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    const labels = new Map<string, string>();
    const push = (id: string, label: string) => {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
        labels.set(id, label);
      }
    };
    buckets.forEach((name) => {
      const id = normalizeBucketId(name);
      push(id, name);
    });
    boardTasks.forEach((t) => {
      const id = t.bucketId;
      const label = id === UNASSIGNED_BUCKET_ID ? UNASSIGNED_BUCKET_LABEL : id;
      push(id, label);
    });
    if (ids.length === 0) push(UNASSIGNED_BUCKET_ID, UNASSIGNED_BUCKET_LABEL);
    return ids.map((id) => ({
      id,
      name: labels.get(id) ?? id,
      color: getBucketColorSync(id, bucketColors),
    }));
  }, [buckets, boardTasks, bucketColors]);

  // List view data
  const listTasks: ListTask[] = useMemo(() => {
    return filteredTasks.map((t) => ({
      id: t.id.toString(),
      title: t.content,
      completed: t.completed,
      bucket: t.bucket ?? null,
      dueDate: t.due?.date ?? null,
      isRecurring: t.due?.is_recurring ?? false,
      position: typeof t.position === "number" ? t.position : null,
    }));
  }, [filteredTasks]);

  const handleQuickAdd = async () => {
    const trimmed = quickTask.trim();
    if (!trimmed) return;

    setIsCreatingTask(true);
    try {
      await createTask(trimmed, null, undefined, quickBucket || undefined);
      toast({
        title: "Task created",
        description: `"${trimmed}" added to ${quickBucket || "Unsorted"}`,
      });
      setQuickTask("");
      quickAddInputRef.current?.focus();
    } catch {
      toast({
        title: "Failed to create task",
        description: "Please try again.",
        type: "error",
      });
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleToggleTask = useCallback(
    async (taskId: string) => {
      setLoadingTasks((prev) => new Set(prev).add(taskId));
      try {
        await toggleTaskCompletion(taskId);
      } catch {
        toast({
          title: "Failed to update task",
          description: "Please try again.",
          type: "error",
        });
      } finally {
        setLoadingTasks((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [toggleTaskCompletion, toast]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      setLoadingTasks((prev) => new Set(prev).add(taskId));
      try {
        await deleteTask(taskId);
        toast({ title: "Task deleted" });
      } catch {
        toast({
          title: "Failed to delete task",
          description: "Please try again.",
          type: "error",
        });
      } finally {
        setLoadingTasks((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [deleteTask, toast]
  );

  const handleMoveTask = useCallback(
    async (taskId: string, newBucketId: string) => {
      const newBucket = newBucketId === UNASSIGNED_BUCKET_ID ? undefined : newBucketId;
      setLoadingTasks((prev) => new Set(prev).add(taskId));
      try {
        await batchUpdateTasks([{ taskId, updates: { bucket: newBucket } }]);
        toast({
          title: "Task moved",
          description: `Task moved to ${newBucket || "Unsorted"}`,
        });
      } catch {
        toast({
          title: "Failed to move task",
          description: "Please try again.",
          type: "error",
        });
      } finally {
        setLoadingTasks((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [batchUpdateTasks, toast]
  );

  const handleEditTask = useCallback(
    (taskId: string) => {
      taskEditorRef.current?.openByTaskId(taskId);
    },
    []
  );

  const handleAddTaskFromList = useCallback(
    async (title: string, bucket?: string) => {
      try {
        await createTask(title, null, undefined, bucket || undefined);
        toast({
          title: "Task created",
          description: `"${title}" added`,
        });
      } catch {
        toast({
          title: "Failed to create task",
          description: "Please try again.",
          type: "error",
        });
      }
    },
    [createTask, toast]
  );

  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col gap-5 px-8 py-6">
      {/* Header */}
      <div className="flex flex-col gap-5">
        {/* Title Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ListTodo size={20} className="text-[#314158]" />
            <h2 className="text-[20px] text-[#314158] font-semibold">All Tasks</h2>
            <span className="text-[13px] text-[#8e99a8]">
              {filteredTasks.length} tasks
            </span>
          </div>

          {/* Search */}
          <div className="relative flex items-center max-w-xs">
            <Search size={16} className="absolute left-3 text-[#8e99a8]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#dbd6cf] bg-white text-[13px] text-[#314158] placeholder:text-[#b5b0a8] focus:outline-none focus:ring-2 focus:ring-[rgba(177,145,106,0.3)] focus:border-[#B1916A] transition-colors"
            />
          </div>
        </div>

        {/* Quick Add Bar */}
        <div className="flex items-center gap-2 rounded-xl border border-[#dbd6cf] bg-white p-2 shadow-[0px_1px_3px_rgba(163,133,96,0.06)]">
          <Input
            ref={quickAddInputRef}
            value={quickTask}
            onChange={(e) => setQuickTask(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 border-0 focus-visible:ring-0 h-8 text-[14px] text-[#314158] placeholder:text-[#b5b0a8]"
            disabled={isCreatingTask}
            onKeyDown={(event) => {
              if (event.key === "Enter" && quickTask.trim()) {
                event.preventDefault();
                handleQuickAdd();
              }
            }}
          />
          <select
            value={quickBucket}
            onChange={(event) => setQuickBucket(event.target.value)}
            disabled={isCreatingTask}
            className="h-8 rounded-lg border border-[#dbd6cf] bg-[rgba(252,250,248,0.5)] px-3 text-[12px] text-[#596881] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(177,145,106,0.3)]"
          >
            <option value="">Unsorted</option>
            {buckets.map((bucket) => (
              <option key={bucket} value={bucket}>
                {bucket}
              </option>
            ))}
          </select>
          <button
            onClick={handleQuickAdd}
            disabled={!quickTask.trim() || isCreatingTask}
            className="h-8 px-4 rounded-lg bg-[#B1916A] text-white text-[13px] font-medium hover:bg-[#96784f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {isCreatingTask ? (
              "..."
            ) : (
              <>
                <Plus size={14} />
                Add
              </>
            )}
          </button>
        </div>

        {/* Tabs + Filter */}
        <TaskBoardTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          filters={filters}
          onFiltersChange={setFilters}
          bucketOptions={buckets}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2">
        {activeTab === "lists" && (
          <TaskListView
            tasks={listTasks}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onEditTask={handleEditTask}
            onAddTask={handleAddTaskFromList}
            loadingTasks={loadingTasks}
            bucketColors={bucketColors}
          />
        )}

        {activeTab === "board" && (
          <TasksBoard
            buckets={boardBuckets}
            tasks={boardTasks}
            onCompleteTask={handleToggleTask}
            onUncompleteTask={handleToggleTask}
            onAddTask={(bucketId, title) => {
              const resolvedBucket =
                bucketId === UNASSIGNED_BUCKET_ID ? undefined : bucketId;
              void createTask(title, null, undefined, resolvedBucket);
            }}
            onMoveTask={handleMoveTask}
            viewMode="open"
            loadingTasks={loadingTasks}
            onTaskOpen={(taskId) => {
              taskEditorRef.current?.openByTaskId(taskId);
            }}
          />
        )}
      </div>

      <TaskEditorModal
        ref={taskEditorRef}
        availableBuckets={buckets}
        selectedBucket={quickBucket || null}
        getDefaultDate={() => format(new Date(), "yyyy-MM-dd")}
      />
    </div>
  );
}

export default function TasksPageClient() {
  return (
    <ToastProvider>
      <TasksProvider selectedDate={new Date()}>
        <SidebarLayout>
          <TasksBoardShell />
        </SidebarLayout>
      </TasksProvider>
    </ToastProvider>
  );
}
