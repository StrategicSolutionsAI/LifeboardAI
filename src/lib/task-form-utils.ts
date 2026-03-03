"use client";

import { format } from "date-fns";
import type { RepeatOption, Task } from "@/types/tasks";

export const UNASSIGNED_BUCKET_LABEL = "Unassigned";

export const sanitizeBucketName = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const extractHourLabel = (hourSlot?: string | null) => {
  if (!hourSlot) return "";
  return hourSlot.replace(/^hour-/, "");
};

export const isoToHourLabel = (iso?: string | null) => {
  if (!iso) return "";
  try {
    return format(new Date(iso), "h a").replace(" ", "");
  } catch (error) {
    console.error("Failed to parse ISO time for label", error);
    return "";
  }
};

type TaskLike = Partial<Task> & {
  due?: {
    is_recurring?: boolean;
    string?: string | null;
  } | null;
  repeatRule?: RepeatOption | null;
};

export const deriveRepeatOption = (task: TaskLike | undefined | null): RepeatOption => {
  if (!task) return "none";
  if (task.repeatRule) return task.repeatRule as RepeatOption;
  if (task.due?.is_recurring && typeof task.due?.string === "string") {
    const normalized = task.due.string.trim().toLowerCase().replace(/\s+starting\s+.+$/, "");
    switch (normalized) {
      case "every day":
      case "daily":
        return "daily";
      case "every week":
      case "weekly":
        return "weekly";
      case "every weekday":
      case "weekdays":
      case "every workday":
        return "weekdays";
      case "every month":
      case "monthly":
        return "monthly";
    }
  }
  return "none";
};
