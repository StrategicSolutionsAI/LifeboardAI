"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { TasksProvider, useTasksContext } from "@/contexts/tasks-context";
import { useBuckets } from "@/hooks/use-buckets";
import type { Bucket as BoardBucket, Task as BoardTask } from "@/components/TasksBoard";
import type { TaskEditorModalHandle } from "@/components/task-editor-modal";
import type { ListTask } from "@/components/task-list-view";
import type { KanbanTask } from "@/components/task-kanban-board";
import type { KanbanStatus } from "@/hooks/use-tasks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { differenceInCalendarDays, parseISO, isValid, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Plus, Search, Activity, CheckCircle2, AlertTriangle, X, ListChecks, CheckSquare, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
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

const TaskKanbanBoard = dynamic(
  () => import("@/components/task-kanban-board").then((m) => ({ default: m.TaskKanbanBoard })),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[520px] rounded-xl border border-[#dbd6cf] bg-white p-4">
            <div className="h-full animate-pulse rounded-lg bg-[rgba(177,145,106,0.05)]" />
          </div>
        ))}
      </div>
    ),
  }
);

import TaskEditorModal from "@/components/task-editor-modal";

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
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

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

  const overdueTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return openTasks.filter((t) => {
      if (!t.due?.date) return false;
      if (t.due?.is_recurring) return false;
      const parsed = parseISO(t.due.date);
      return isValid(parsed) && parsed < today;
    });
  }, [openTasks]);

  const inProgressTasks = useMemo(() => {
    return openTasks.filter((t) => {
      const status = t.kanbanStatus ?? (t.completed ? "done" : "todo");
      return status === "in_progress";
    });
  }, [openTasks]);

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
      kanbanStatus: (t.kanbanStatus ?? (t.completed ? "done" : "todo")) as "todo" | "in_progress" | "done",
    }));
  }, [filteredTasks]);

  // Kanban view data
  const kanbanTasks: KanbanTask[] = useMemo(() => {
    return filteredTasks.map((t) => ({
      id: t.id.toString(),
      title: t.content,
      bucket: t.bucket ?? null,
      dueDate: t.due?.date ?? null,
      isRecurring: t.due?.is_recurring ?? false,
      kanbanStatus: t.kanbanStatus ?? (t.completed ? "done" : "todo") as KanbanStatus,
      completed: t.completed,
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

  const handleKanbanStatusChange = useCallback(
    async (taskId: string, newStatus: KanbanStatus) => {
      setLoadingTasks((prev) => new Set(prev).add(taskId));
      try {
        const updates: Record<string, unknown> = { kanbanStatus: newStatus };
        // Bidirectional sync: moving to "done" → completed, moving from "done" → not completed
        if (newStatus === "done") {
          updates.completed = true;
        } else {
          updates.completed = false;
        }
        await batchUpdateTasks([{ taskId, updates }]);
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
    [batchUpdateTasks, toast]
  );

  const handleAddTaskFromKanban = useCallback(
    async (title: string, status: KanbanStatus) => {
      try {
        await createTask(title, null, undefined, undefined);
        // If created as done or in_progress, update the status
        // Note: createTask creates with kanban_status='todo' by default
        // For non-todo, we need a follow-up batch update
        // For simplicity and to avoid needing the task ID back, we just create with default
        toast({
          title: "Task created",
          description: `"${title}" added to ${status === "todo" ? "To Do" : status === "in_progress" ? "In Progress" : "Done"}`,
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

  const toggleSelection = useCallback((taskId: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleBulkComplete = useCallback(async () => {
    const ids = Array.from(selectedTasks);
    for (const id of ids) {
      await toggleTaskCompletion(id);
    }
    setSelectedTasks(new Set());
    setIsSelectMode(false);
    toast({ title: `${ids.length} task${ids.length === 1 ? "" : "s"} completed` });
  }, [selectedTasks, toggleTaskCompletion, toast]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedTasks);
    for (const id of ids) {
      await deleteTask(id);
    }
    setSelectedTasks(new Set());
    setIsSelectMode(false);
    toast({ title: `${ids.length} task${ids.length === 1 ? "" : "s"} deleted` });
  }, [selectedTasks, deleteTask, toast]);

  const clearSelection = useCallback(() => {
    setSelectedTasks(new Set());
    setIsSelectMode(false);
  }, []);

  // Completion percentage for progress ring
  const completionPct = allTasks.length > 0 ? Math.round((totalCompleted / allTasks.length) * 100) : 0;
  const circumference = 2 * Math.PI * 18; // r=18
  const dashOffset = circumference - (completionPct / 100) * circumference;

  // Stat-based quick filter
  const handleStatClick = (stat: "total" | "in-progress" | "completed" | "overdue") => {
    switch (stat) {
      case "total":
        setFilters({ ...defaultTaskFilters });
        break;
      case "in-progress":
        setFilters({ ...defaultTaskFilters, status: "open" });
        break;
      case "completed":
        setFilters({ ...defaultTaskFilters, status: "completed" });
        break;
      case "overdue":
        setFilters({ ...defaultTaskFilters, dueDateRange: "overdue", status: "open" });
        break;
    }
  };

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape" && isSelectMode) {
        clearSelection();
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        quickAddInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelectMode, clearSelection]);

  const hasActiveFilters = filters.status !== "all" || filters.buckets.length > 0 || filters.dueDateRange !== null;

  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col gap-3 sm:gap-4 px-4 sm:px-6 md:px-8 py-4 sm:py-5">
      {/* ── Header Row: Progress ring + Title + Stats + Search ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-5">
          {/* Progress ring */}
          <div className="relative shrink-0 hidden sm:flex">
            <svg width="52" height="52" viewBox="0 0 44 44" className="-rotate-90">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(219,214,207,0.4)" strokeWidth="3" />
              <circle
                cx="22" cy="22" r="18" fill="none"
                stroke="#48B882" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={dashOffset}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#314158]">
              {completionPct}%
            </span>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2 className="text-[20px] text-[#314158] font-semibold leading-tight">Tasks</h2>
            <span className="text-[12px] text-[#8e99a8]">
              {totalOpen} open{totalCompleted > 0 ? ` · ${totalCompleted} done` : ""}
            </span>
          </div>


          {/* Select mode toggle */}
          <button
            onClick={() => {
              if (isSelectMode) {
                clearSelection();
              } else {
                setIsSelectMode(true);
              }
            }}
            className={`shrink-0 p-2 rounded-lg transition-all duration-200 ${
              isSelectMode
                ? "bg-[rgba(177,145,106,0.12)] text-[#314158] ring-1 ring-[rgba(177,145,106,0.25)]"
                : "text-[#8e99a8] hover:bg-[rgba(177,145,106,0.06)] hover:text-[#596881]"
            } ml-auto`}
            aria-label={isSelectMode ? "Exit select mode" : "Select tasks"}
          >
            <ListChecks size={18} />
          </button>

          {/* Search toggle */}
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`shrink-0 p-2 rounded-lg transition-all duration-200 ${
              isSearchOpen || searchQuery
                ? "bg-[rgba(177,145,106,0.12)] text-[#314158]"
                : "text-[#8e99a8] hover:bg-[rgba(177,145,106,0.06)] hover:text-[#596881]"
            }`}
            aria-label="Search tasks"
          >
            <Search size={18} />
          </button>
        </div>

        {/* Expandable search bar */}
        {isSearchOpen && (
          <div className="relative flex items-center animate-in fade-in slide-in-from-top-2 duration-200">
            <Search size={15} className="absolute left-3 text-[#8e99a8]" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by task name or bucket..."
              className="w-full h-9 pl-9 pr-9 rounded-lg border border-[#dbd6cf] bg-white text-[13px] text-[#314158] placeholder:text-[#b5b0a8] focus:outline-none focus:ring-2 focus:ring-[rgba(177,145,106,0.3)] focus:border-[#B1916A] transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchQuery("");
                  setIsSearchOpen(false);
                }
              }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); }}
                className="absolute right-3 text-[#8e99a8] hover:text-[#596881]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* ── Stat Tiles ── */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={() => handleStatClick("in-progress")}
            className={cn(
              "flex items-center gap-3 px-3.5 py-3 rounded-xl border bg-white transition-all text-left",
              filters.status === "open" && !filters.dueDateRange
                ? "border-[rgba(74,173,224,0.4)] ring-1 ring-[rgba(74,173,224,0.15)] shadow-sm"
                : "border-[#dbd6cf]/80 hover:border-[rgba(74,173,224,0.3)] hover:shadow-[0px_2px_8px_rgba(163,133,96,0.06)]"
            )}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: "rgba(74,173,224,0.15)" }}
            >
              <Activity size={18} style={{ color: "#4AADE0" }} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[18px] font-bold text-[#314158] leading-tight">{inProgressTasks.length}</span>
              <span className="text-[11px] text-[#8e99a8]">In Progress</span>
            </div>
          </button>

          <button
            onClick={() => handleStatClick("completed")}
            className={cn(
              "flex items-center gap-3 px-3.5 py-3 rounded-xl border bg-white transition-all text-left",
              filters.status === "completed"
                ? "border-[rgba(72,184,130,0.4)] ring-1 ring-[rgba(72,184,130,0.15)] shadow-sm"
                : "border-[#dbd6cf]/80 hover:border-[rgba(72,184,130,0.3)] hover:shadow-[0px_2px_8px_rgba(163,133,96,0.06)]"
            )}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: "rgba(72,184,130,0.15)" }}
            >
              <CheckCircle2 size={18} style={{ color: "#48B882" }} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[18px] font-bold text-[#314158] leading-tight">{totalCompleted}</span>
              <span className="text-[11px] text-[#8e99a8]">Done</span>
            </div>
          </button>

          <button
            onClick={() => handleStatClick("overdue")}
            className={cn(
              "flex items-center gap-3 px-3.5 py-3 rounded-xl border bg-white transition-all text-left",
              filters.dueDateRange === "overdue"
                ? "border-[rgba(177,145,106,0.4)] ring-1 ring-[rgba(177,145,106,0.15)] shadow-sm"
                : "border-[#dbd6cf]/80 hover:border-[rgba(177,145,106,0.3)] hover:shadow-[0px_2px_8px_rgba(163,133,96,0.06)]"
            )}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: "rgba(177,145,106,0.12)" }}
            >
              <AlertTriangle size={18} style={{ color: "#B1916A" }} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[18px] font-bold text-[#314158] leading-tight">{overdueTasks.length}</span>
              <span className="text-[11px] text-[#8e99a8]">Overdue</span>
            </div>
          </button>
        </div>

        {/* ── Quick Add Bar ── */}
        <div className="flex items-center gap-2 rounded-xl border border-[#dbd6cf] bg-white p-2 shadow-[0px_1px_3px_rgba(163,133,96,0.04)] focus-within:ring-2 focus-within:ring-[rgba(177,145,106,0.2)] focus-within:border-[rgba(177,145,106,0.4)] transition-all">
          <div className="flex items-center justify-center w-8 h-8 shrink-0">
            <Plus size={16} className="text-[#bb9e7b]" />
          </div>
          <Input
            ref={quickAddInputRef}
            value={quickTask}
            onChange={(e) => setQuickTask(e.target.value)}
            placeholder="Add a new task...   press n"
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
            {isCreatingTask ? "..." : "Add"}
          </button>
        </div>

        {/* ── Tabs + Filter ── */}
        <TaskBoardTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          filters={filters}
          onFiltersChange={setFilters}
          bucketOptions={buckets}
          bucketColors={bucketColors}
        />

        {/* Active filter indicator */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[rgba(177,145,106,0.06)] border border-[rgba(177,145,106,0.15)] animate-in fade-in slide-in-from-top-1 duration-200">
            <span className="text-[12px] text-[#596881]">
              Showing <span className="font-semibold text-[#314158]">{filteredTasks.length}</span> of {allTasks.length} tasks
              {filters.status !== "all" && <span className="text-[#B1916A]"> ({filters.status})</span>}
              {filters.dueDateRange && <span className="text-[#B1916A]"> ({filters.dueDateRange})</span>}
            </span>
            <button
              onClick={() => setFilters(defaultTaskFilters)}
              className="text-[12px] text-[#B1916A] hover:text-[#96784f] font-medium transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* ── Content Area ── */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
        {allTasks.length === 0 ? (
          /* ── Beautiful Empty State ── */
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] animate-in fade-in duration-500">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[rgba(177,145,106,0.1)] to-[rgba(177,145,106,0.04)] border border-[rgba(219,214,207,0.5)] flex items-center justify-center">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-[#bb9e7b]">
                  <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#48B882] flex items-center justify-center">
                <Plus size={12} className="text-white" />
              </div>
            </div>
            <h3 className="text-[18px] font-semibold text-[#314158] mb-2">
              Start organizing your tasks
            </h3>
            <p className="text-[14px] text-[#8e99a8] text-center max-w-[320px] mb-6 leading-relaxed">
              Add your first task using the quick-add bar above, or press <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-[#dbd6cf] bg-[rgba(252,250,248,0.8)] text-[11px] font-mono text-[#596881]">n</kbd> to get started.
            </p>
            <button
              onClick={() => quickAddInputRef.current?.focus()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B1916A] text-white text-[14px] font-medium hover:bg-[#96784f] transition-colors shadow-[0px_2px_8px_rgba(177,145,106,0.25)]"
            >
              <Plus size={16} />
              Add your first task
            </button>
          </div>
        ) : (
          /* ── Tab Content with Crossfade ── */
          <div key={activeTab} className="animate-in fade-in duration-200">
            {activeTab === "lists" && (
              <TaskListView
                tasks={listTasks}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onEditTask={handleEditTask}
                onAddTask={handleAddTaskFromList}
                onStatusChange={handleKanbanStatusChange}
                loadingTasks={loadingTasks}
                bucketColors={bucketColors}
                searchQuery={searchQuery}
                isSelectMode={isSelectMode}
                selectedTasks={selectedTasks}
                onToggleSelection={toggleSelection}
                onReorder={async (reorderedIds) => {
                  const updates = reorderedIds.map((id, index) => ({
                    taskId: id,
                    updates: { position: index },
                  }));
                  await batchUpdateTasks(updates);
                }}
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

            {activeTab === "kanban" && (
              <TaskKanbanBoard
                tasks={kanbanTasks}
                onStatusChange={handleKanbanStatusChange}
                onAddTask={handleAddTaskFromKanban}
                onTaskOpen={(taskId) => {
                  taskEditorRef.current?.openByTaskId(taskId);
                }}
                bucketColors={bucketColors}
                loadingTasks={loadingTasks}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Floating Bulk Action Bar ── */}
      {isSelectMode && selectedTasks.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#314158] text-white shadow-[0px_8px_30px_rgba(49,65,88,0.35)]">
            <span className="text-[13px] font-medium opacity-90">
              {selectedTasks.size} selected
            </span>
            <div className="w-px h-5 bg-white/20" />
            <button
              onClick={handleBulkComplete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium hover:bg-white/10 transition-colors"
            >
              <CheckCircle2 size={14} />
              Complete
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-red-300 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
            <div className="w-px h-5 bg-white/20" />
            <button
              onClick={clearSelection}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[13px] opacity-70 hover:opacity-100 hover:bg-white/10 transition-all"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <TaskEditorModal
        ref={taskEditorRef}
        availableBuckets={buckets}
        selectedBucket={quickBucket || null}
        getDefaultDate={() => format(new Date(), "yyyy-MM-dd")}
        bucketColors={bucketColors}
      />
    </div>
  );
}

export default function TasksPageClient() {
  return (
    <ToastProvider>
      <TasksProvider selectedDate={new Date()}>
        <TasksBoardShell />
      </TasksProvider>
    </ToastProvider>
  );
}
