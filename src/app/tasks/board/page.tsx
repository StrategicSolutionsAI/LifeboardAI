"use client";

import React, { useMemo } from "react";
import TasksBoard, { type Bucket as BoardBucket, type Task as BoardTask } from "@/components/TasksBoard";
import { TasksProvider, useTasksContext } from "@/contexts/tasks-context";
import { useBuckets } from "@/hooks/use-buckets";
import { Button } from "@/components/ui/button";

const UNASSIGNED_BUCKET_ID = "__unassigned";
const UNASSIGNED_BUCKET_LABEL = "Unsorted";
const BUCKET_COLOR_PALETTE = ["#4F46E5","#22C55E","#F97316","#EC4899","#14B8A6","#8B5CF6","#F59E0B","#06B6D4"] as const;

function normalizeBucketId(name?: string | null) {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : UNASSIGNED_BUCKET_ID;
}

function bucketColorFromId(id: string) {
  if (id === UNASSIGNED_BUCKET_ID) return "#94A3B8"; // slate-400
  let hash = 0;
  for (let i = 0; i < id.length; i++) { hash = (hash << 5) - hash + id.charCodeAt(i); hash |= 0 }
  const idx = Math.abs(hash) % BUCKET_COLOR_PALETTE.length;
  return BUCKET_COLOR_PALETTE[idx];
}

function BoardContent() {
  const { allTasks, toggleTaskCompletion, createTask } = useTasksContext();
  const { buckets: availableBuckets } = useBuckets();

  const openTasks = useMemo(() => allTasks.filter(t => !t.completed), [allTasks]);

  const boardTasks: BoardTask[] = useMemo(() => (
    openTasks.map((t) => ({
      id: t.id.toString(),
      title: t.content,
      bucketId: normalizeBucketId(t.bucket),
      status: 'open',
      position: typeof t.position === 'number' ? t.position : null,
    }))
  ), [openTasks]);

  const boardBuckets: BoardBucket[] = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    const labels = new Map<string, string>();
    const push = (id: string, label: string) => { if (!seen.has(id)) { seen.add(id); ids.push(id); labels.set(id, label) } };
    availableBuckets.forEach((name) => { const id = normalizeBucketId(name); push(id, name) });
    boardTasks.forEach((t) => { const id = t.bucketId; const label = id === UNASSIGNED_BUCKET_ID ? UNASSIGNED_BUCKET_LABEL : id; push(id, label) });
    if (ids.length === 0) push(UNASSIGNED_BUCKET_ID, UNASSIGNED_BUCKET_LABEL);
    return ids.map((id) => ({ id, name: labels.get(id) ?? id, color: bucketColorFromId(id) }));
  }, [availableBuckets, boardTasks]);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col px-4 py-4 gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Tasks Board</h1>
        <Button asChild variant="secondary" size="sm">
          <a href="/calendar">Back to Calendar</a>
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <TasksBoard
          buckets={boardBuckets}
          tasks={boardTasks}
          onCompleteTask={(id) => toggleTaskCompletion(id)}
          onAddTask={(bucketId, title) => {
            const resolvedBucket = bucketId === UNASSIGNED_BUCKET_ID ? undefined : bucketId;
            void createTask(title, null, undefined, resolvedBucket);
          }}
        />
      </div>
    </div>
  );
}

export default function TasksBoardPage() {
  return (
    <TasksProvider selectedDate={new Date()}>
      <BoardContent />
    </TasksProvider>
  );
}

