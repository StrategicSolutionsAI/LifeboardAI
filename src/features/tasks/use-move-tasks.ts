"use client";

import { useCallback } from "react";
import type { Task } from "@/types/tasks";
import { useTaskActions } from "@/contexts/tasks-context";
import { useToast } from "@/components/ui/use-toast";
import { dateLabel } from "@/lib/quick-add-parser";

/**
 * Move tasks to a date (null = Someday) in one batch, with an undo toast that
 * restores each task's own previous date. Shared by the Today tab and the
 * calendar's day list so a move behaves the same wherever it starts.
 */
export function useMoveTasks() {
  const { batchUpdateTasks } = useTaskActions();
  const { toast } = useToast();

  return useCallback(async (list: Task[], date: string | null) => {
    if (list.length === 0) return;
    const previous = list.map((t) => ({ id: t.id, date: t.due?.date ?? null }));
    const apply = (entries: Array<{ id: string; date: string | null }>) =>
      batchUpdateTasks(entries.map((e) => ({
        taskId: e.id,
        // null, not { date: undefined }: the Todoist route only clears on null.
        updates: { due: e.date ? { date: e.date } : null, startDate: e.date },
      })));
    try {
      await apply(list.map((t) => ({ id: t.id, date })));
      const where = date ? dateLabel(date, new Date()) : "Someday";
      toast({
        title: list.length === 1 ? `Moved to ${where}` : `${list.length} tasks moved to ${where}`,
        description: list.length === 1 ? list[0].content : undefined,
        type: "success",
        undoAction: () => void apply(previous),
      });
    } catch {
      toast({ title: "Couldn't move tasks", description: "Please try again.", type: "error" });
    }
  }, [batchUpdateTasks, toast]);
}
