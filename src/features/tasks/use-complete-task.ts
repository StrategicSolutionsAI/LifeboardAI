"use client";

import { useCallback } from "react";
import { useTaskActions, useTaskData } from "@/contexts/tasks-context";
import { useToast } from "@/components/ui/use-toast";
import { dateStr } from "@/lib/date-utils";
import { dateLabel } from "@/lib/quick-add-parser";
import { completesPerOccurrence, nextOccurrence } from "@/features/tasks/today-plan";

/**
 * The checkbox for lists that show tasks rather than one day (Upcoming, All
 * Open Tasks, the dashboard): a repeating task finishes its next occurrence
 * and the series carries on, as in Todoist. A series ends through Delete →
 * "this and future". Everything else completes as before.
 */
export function useCompleteTask() {
  const { allTasks, occurrenceExceptionIndex } = useTaskData();
  const { toggleTaskCompletion, setOccurrenceDone } = useTaskActions();
  const { toast } = useToast();

  return useCallback(async (taskId: string) => {
    const task = allTasks.find((t) => t.id.toString() === taskId.toString());
    const now = new Date();
    const day = task && !task.completed && completesPerOccurrence(task)
      ? nextOccurrence(task, dateStr(now), occurrenceExceptionIndex)
      : null;
    if (!task || !day) {
      await toggleTaskCompletion(taskId);
      return;
    }
    try {
      await setOccurrenceDone(task, day, true);
      const label = dateLabel(day, now);
      toast({
        // The row stays put, so say what happened.
        title: `Done for ${/^(Today|Tomorrow)$/.test(label) ? label.toLowerCase() : label}`,
        description: `${task.content} repeats, so it stays on the list.`,
        type: "success",
        undoAction: () => void setOccurrenceDone(task, day, false),
      });
    } catch {
      toast({ title: "Couldn't update that task", description: "Please try again.", type: "error" });
    }
  }, [allTasks, occurrenceExceptionIndex, setOccurrenceDone, toast, toggleTaskCompletion]);
}
