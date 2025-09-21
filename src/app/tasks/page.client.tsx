"use client";

import React, { useEffect, useMemo, useState } from "react";
import { SidebarLayout } from "@/components/sidebar-layout";
import { TasksProvider, useTasksContext } from "@/contexts/tasks-context";
import { useBuckets } from "@/hooks/use-buckets";
import TasksBoard, { type Bucket as BoardBucket, type Task as BoardTask } from "@/components/TasksBoard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { differenceInCalendarDays, parseISO, isValid } from "date-fns";
import { Plus } from "lucide-react";

const UNASSIGNED_BUCKET_ID = "__unassigned";
const UNASSIGNED_BUCKET_LABEL = "Unsorted";
const BUCKET_COLOR_PALETTE = ["#4F46E5","#22C55E","#F97316","#EC4899","#14B8A6","#8B5CF6","#F59E0B","#06B6D4"] as const;

function normalizeBucketId(name?: string | null) {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : UNASSIGNED_BUCKET_ID;
}

function bucketColorFromId(id: string) {
  if (id === UNASSIGNED_BUCKET_ID) return "#94A3B8";
  let hash = 0;
  for (let i = 0; i < id.length; i++) { hash = (hash << 5) - hash + id.charCodeAt(i); hash |= 0 }
  const idx = Math.abs(hash) % BUCKET_COLOR_PALETTE.length;
  return BUCKET_COLOR_PALETTE[idx];
}

function TasksBoardShell() {
  const { allTasks, toggleTaskCompletion, createTask, batchUpdateTasks } = useTasksContext();
  const { buckets } = useBuckets();
  const [quickTask, setQuickTask] = useState("");
  const [quickBucket, setQuickBucket] = useState<string>(buckets[0] ?? "");
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  useEffect(() => {
    if (!quickBucket && buckets.length > 0) {
      setQuickBucket(buckets[0]);
    }
  }, [buckets, quickBucket]);

  const openTasks = useMemo(() => allTasks.filter(t => !t.completed), [allTasks]);

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

  const boardTasks: BoardTask[] = useMemo(() => (
    openTasks.map((t) => ({
      id: t.id.toString(),
      title: t.content,
      bucketId: normalizeBucketId(t.bucket),
      status: 'open',
      position: typeof t.position === 'number' ? t.position : null,
      dueDate: t.due?.date ?? null,
      createdAt: t.created_at ?? null,
    }))
  ), [openTasks]);

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
    return ids.map((id) => ({ id, name: labels.get(id) ?? id, color: bucketColorFromId(id) }));
  }, [buckets, boardTasks]);

  const totalOpen = openTasks.length;
  const dueSoonCount = openTasks.filter((t) => isDueSoon(t.due?.date ?? null)).length;
  const bucketCount = boardBuckets.length;

  const handleQuickAdd = async () => {
    const trimmed = quickTask.trim();
    if (!trimmed) return;
    await createTask(trimmed, null, undefined, quickBucket || undefined);
    setQuickTask("");
    setQuickAddOpen(false);
  };

  const handleMoveTask = async (taskId: string, newBucketId: string) => {
    const newBucket = newBucketId === UNASSIGNED_BUCKET_ID ? undefined : newBucketId;
    await batchUpdateTasks([
      { taskId, updates: { bucket: newBucket } }
    ]);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col gap-6 px-4 py-6">
      <header className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Stay ahead by reviewing everything that’s still open across your buckets.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              onClick={() => {
                setQuickAddOpen((prev) => !prev);
                if (!quickBucket && buckets.length > 0) {
                  setQuickBucket(buckets[0]);
                }
              }}
            >
              <Plus className="h-4 w-4" />
              New task
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Open tasks</p>
            <p className="mt-2 text-2xl font-semibold">{totalOpen}</p>
            <p className="mt-1 text-xs text-muted-foreground">Active items across every bucket.</p>
          </Card>
          <Card className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Due soon</p>
            <p className="mt-2 text-2xl font-semibold">{dueSoonCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">Within the next three days.</p>
          </Card>
          <Card className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Buckets</p>
            <p className="mt-2 text-2xl font-semibold">{bucketCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">Organize work by focus areas.</p>
          </Card>
        </div>

        {quickAddOpen && (
          <Card className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="text-xs font-medium uppercase tracking-wide text-primary">Task</label>
                <Input
                  value={quickTask}
                  onChange={(e) => setQuickTask(e.target.value)}
                  placeholder="Describe what you need to do"
                  className="mt-1"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleQuickAdd();
                    }
                  }}
                />
              </div>
              <div className="md:w-52">
                <label className="text-xs font-medium uppercase tracking-wide text-primary">Bucket</label>
                <select
                  value={quickBucket}
                  onChange={(event) => setQuickBucket(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <option value="">Unsorted</option>
                  {buckets.map((bucket) => (
                    <option key={bucket} value={bucket}>
                      {bucket}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 md:pb-0">
                <Button onClick={handleQuickAdd} type="button" disabled={!quickTask.trim()}>
                  Add
                </Button>
                <Button variant="ghost" type="button" onClick={() => setQuickAddOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}
      </header>

      <div className="flex-1 min-h-0">
        <TasksBoard
          buckets={boardBuckets}
          tasks={boardTasks}
          onCompleteTask={(id) => toggleTaskCompletion(id)}
          onAddTask={(bucketId, title) => {
            const resolvedBucket = bucketId === UNASSIGNED_BUCKET_ID ? undefined : bucketId;
            void createTask(title, null, undefined, resolvedBucket);
          }}
          onMoveTask={handleMoveTask}
        />
      </div>
    </div>
  );
}

export default function TasksPageClient() {
  return (
    <TasksProvider selectedDate={new Date()}>
      <SidebarLayout>
        <TasksBoardShell />
      </SidebarLayout>
    </TasksProvider>
  );
}
