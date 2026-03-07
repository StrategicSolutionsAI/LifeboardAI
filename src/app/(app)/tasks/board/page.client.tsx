"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { type Bucket as BoardBucket, type Task as BoardTask } from "@/features/tasks/components/TasksBoard";
import { TasksProvider, useTaskData, useTaskActions } from "@/contexts/tasks-context";
import { useBuckets } from "@/hooks/use-buckets";
import { useFamilyMembers } from "@/hooks/use-family-members";
import { Button } from "@/components/ui/button";
import { getBucketColorSync, UNASSIGNED_BUCKET_ID } from "@/lib/bucket-colors";
import { getUserPreferencesClient } from "@/lib/user-preferences";

const TasksBoard = dynamic(() => import("@/features/tasks/components/TasksBoard"), {
  ssr: false,
  loading: () => (
    <div className="h-full rounded-xl border border-theme-neutral-300 bg-white p-4">
      <div className="h-full animate-pulse rounded-lg bg-theme-brand-tint-subtle" />
    </div>
  ),
});

const UNASSIGNED_BUCKET_LABEL = "Unsorted";

function normalizeBucketId(name?: string | null) {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : UNASSIGNED_BUCKET_ID;
}

function BoardContent() {
  const { allTasks } = useTaskData();
  const { toggleTaskCompletion, createTask } = useTaskActions();
  const { buckets: availableBuckets } = useBuckets();
  const familyMembers = useFamilyMembers();
  const [bucketColors, setBucketColors] = useState<Record<string, string>>({});

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

  const boardTasks: BoardTask[] = useMemo(() => (
    openTasks.map((t) => ({
      id: t.id.toString(),
      title: t.content,
      bucketId: normalizeBucketId(t.bucket),
      status: 'open',
      position: typeof t.position === 'number' ? t.position : null,
      dueDate: t.due?.date ?? null,
      startDate: t.startDate ?? null,
      endDate: t.endDate ?? null,
      assigneeId: t.assigneeId ?? null,
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
    return ids.map((id) => ({ id, name: labels.get(id) ?? id, color: getBucketColorSync(id, bucketColors) }));
  }, [availableBuckets, boardTasks, bucketColors]);

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
          familyMembers={familyMembers}
        />
      </div>
    </div>
  );
}

export default function TasksBoardPageClient() {
  return (
    <TasksProvider selectedDate={new Date()}>
      <BoardContent />
    </TasksProvider>
  );
}
