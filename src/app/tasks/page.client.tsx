"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SidebarLayout } from "@/components/sidebar-layout";
import { TasksProvider, useTasksContext } from "@/contexts/tasks-context";
import { useBuckets } from "@/hooks/use-buckets";
import TasksBoard, { type Bucket as BoardBucket, type Task as BoardTask } from "@/components/TasksBoard";
import TaskEditorModal, { TaskEditorModalHandle } from "@/components/task-editor-modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { differenceInCalendarDays, parseISO, isValid, format } from "date-fns";
import { Plus, Clock } from "lucide-react";
import { getBucketColorSync, UNASSIGNED_BUCKET_ID } from "@/lib/bucket-colors";
import { getUserPreferencesClient } from "@/lib/user-preferences";
import { cn } from "@/lib/utils";
import { useToast, ToastProvider } from "@/components/ui/use-toast";

const UNASSIGNED_BUCKET_LABEL = "Unsorted";

function normalizeBucketId(name?: string | null) {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : UNASSIGNED_BUCKET_ID;
}

function TasksBoardShell() {
  const { allTasks, toggleTaskCompletion, createTask, batchUpdateTasks } = useTasksContext();
  const { buckets } = useBuckets();
  const { toast } = useToast();
  const [bucketColors, setBucketColors] = useState<Record<string, string>>({});
  const [quickTask, setQuickTask] = useState("");
  const [quickBucket, setQuickBucket] = useState<string>(buckets[0] ?? "");
  const [viewMode, setViewMode] = useState<"open" | "completed">("open");
  const [dueSoonOnly, setDueSoonOnly] = useState(false);
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

  const openTasks = useMemo(() => allTasks.filter(t => !t.completed), [allTasks]);
  const completedTasks = useMemo(() => allTasks.filter(t => t.completed), [allTasks]);

  const isDueSoon = (due?: string | null) => {
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
  };

  const filteredOpenTasks = useMemo(() => {
    if (!dueSoonOnly) return openTasks;
    return openTasks.filter((t) => isDueSoon(t.due?.date ?? null));
  }, [openTasks, dueSoonOnly]);

  const tasksForBoard = useMemo(
    () => (viewMode === "open" ? filteredOpenTasks : completedTasks),
    [viewMode, filteredOpenTasks, completedTasks]
  );

  useEffect(() => {
    if (viewMode === "completed" && dueSoonOnly) {
      setDueSoonOnly(false);
    }
  }, [viewMode, dueSoonOnly]);

  const boardTasks: BoardTask[] = useMemo(() => {
    return tasksForBoard.map((t) => ({
      id: t.id.toString(),
      title: t.content,
      bucketId: normalizeBucketId(t.bucket),
      status: t.completed ? 'done' : 'open',
      position: typeof t.position === 'number' ? t.position : null,
      dueDate: t.due?.date ?? null,
      startDate: t.startDate ?? null,
      endDate: t.endDate ?? null,
      createdAt: t.created_at ?? null,
    }));
  }, [tasksForBoard]);

  const boardBuckets: BoardBucket[] = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    const labels = new Map<string, string>();
    const push = (id: string, label: string) => { if (!seen.has(id)) { seen.add(id); ids.push(id); labels.set(id, label) } };
    // Stable order: configured buckets first
    buckets.forEach((name) => { const id = normalizeBucketId(name); push(id, name) });
    // Include any task bucket id
    boardTasks.forEach((t) => { const id = t.bucketId; const label = id === UNASSIGNED_BUCKET_ID ? UNASSIGNED_BUCKET_LABEL : id; push(id, label) });
    if (ids.length === 0) push(UNASSIGNED_BUCKET_ID, UNASSIGNED_BUCKET_LABEL);
    return ids.map((id) => ({ id, name: labels.get(id) ?? id, color: getBucketColorSync(id, bucketColors) }));
  }, [buckets, boardTasks, bucketColors]);

  const totalOpen = openTasks.length;
  const totalCompleted = completedTasks.length;
  const dueSoonCount = openTasks.filter((t) => isDueSoon(t.due?.date ?? null)).length;
  const bucketCount = boardBuckets.length;
  const dueSoonCardDisabled = dueSoonCount === 0 && !dueSoonOnly;
  const dueSoonDescription = dueSoonOnly
    ? "Filter is limited to upcoming deadlines."
    : dueSoonCount === 0
      ? "Nothing due in the next three days."
      : "Within the next three days.";

  const statCards = [
    {
      key: "open",
      title: "Open tasks",
      value: totalOpen,
      description: "Active items across every bucket.",
    },
    {
      key: "dueSoon",
      title: "Due soon",
      value: dueSoonCount,
      description: dueSoonDescription,
    },
    {
      key: "completed",
      title: "Completed tasks",
      value: totalCompleted,
      description: "Tasks you've completed.",
    },
    {
      key: "buckets",
      title: "Buckets",
      value: bucketCount,
      description: "Organize work by focus areas.",
    },
  ];

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
      // Keep focus on input for next task
      quickAddInputRef.current?.focus();
    } catch (error) {
      toast({
        title: "Failed to create task",
        description: "Please try again.",
        type: "error",
      });
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleToggleTask = async (taskId: string) => {
    setLoadingTasks(prev => new Set(prev).add(taskId));
    try {
      await toggleTaskCompletion(taskId);
    } catch (error) {
      toast({
        title: "Failed to update task",
        description: "Please try again.",
        type: "error",
      });
    } finally {
      setLoadingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleMoveTask = async (taskId: string, newBucketId: string) => {
    const newBucket = newBucketId === UNASSIGNED_BUCKET_ID ? undefined : newBucketId;
    setLoadingTasks(prev => new Set(prev).add(taskId));
    try {
      await batchUpdateTasks([
        { taskId, updates: { bucket: newBucket } }
      ]);
      toast({
        title: "Task moved",
        description: `Task moved to ${newBucket || "Unsorted"}`,
      });
    } catch (error) {
      toast({
        title: "Failed to move task",
        description: "Please try again.",
        type: "error",
      });
    } finally {
      setLoadingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col gap-4 px-4 py-6">
      <header className="space-y-4">
        {/* Simplified Header - Title + Quick Add in one row */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalOpen} open · {dueSoonCount > 0 && `${dueSoonCount} due soon · `}{totalCompleted} completed
            </p>
          </div>

          {/* Persistent Quick Add - More compact */}
          <div className="flex items-center gap-2 rounded-lg border border-input bg-background p-1.5 shadow-sm flex-1 max-w-lg">
            <Input
              ref={quickAddInputRef}
              value={quickTask}
              onChange={(e) => setQuickTask(e.target.value)}
              placeholder="Add task..."
              className="flex-1 border-0 focus-visible:ring-0 h-7 text-sm"
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
              className="h-7 rounded-md border-0 bg-muted/50 px-2 text-xs focus-visible:outline-none"
            >
              <option value="">Unsorted</option>
              {buckets.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {bucket}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleQuickAdd}
              disabled={!quickTask.trim() || isCreatingTask}
              className="flex-shrink-0 h-7 px-2"
            >
              {isCreatingTask ? "..." : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Simplified Filter Bar - Single compact row */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "open" && !dueSoonOnly ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setViewMode("open");
                setDueSoonOnly(false);
              }}
              className="h-7 text-xs"
            >
              All Open <span className="ml-1.5 opacity-70">{totalOpen}</span>
            </Button>
            <Button
              variant={dueSoonOnly ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setViewMode("open");
                setDueSoonOnly(true);
              }}
              disabled={dueSoonCount === 0}
              className="h-7 text-xs gap-1"
            >
              <Clock className="h-3 w-3" />
              Due Soon <span className="ml-1 opacity-70">{dueSoonCount}</span>
            </Button>
            <Button
              variant={viewMode === "completed" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setViewMode("completed");
                setDueSoonOnly(false);
              }}
              className="h-7 text-xs"
            >
              Completed <span className="ml-1.5 opacity-70">{totalCompleted}</span>
            </Button>
          </div>

        </div>
      </header>

      <div className="flex-1 min-h-0">
        <TasksBoard
          buckets={boardBuckets}
          tasks={boardTasks}
          onCompleteTask={handleToggleTask}
          onUncompleteTask={handleToggleTask}
          onAddTask={(bucketId, title) => {
            const resolvedBucket = bucketId === UNASSIGNED_BUCKET_ID ? undefined : bucketId;
            void createTask(title, null, undefined, resolvedBucket);
          }}
          onMoveTask={handleMoveTask}
          viewMode={viewMode}
          loadingTasks={loadingTasks}
          onTaskOpen={(taskId) => {
            taskEditorRef.current?.openByTaskId(taskId);
          }}
        />
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
