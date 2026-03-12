import { invalidateAllPreferencesCaches } from "@/lib/user-preferences";

/**
 * Find a pinned "linked_task" widget for the given task ID across all buckets.
 */
export async function findPinnedWidget(
  taskId: string,
): Promise<{ widgetId: string; bucket: string } | null> {
  try {
    const res = await fetch("/api/user/preferences", {
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const prefs = await res.json();
    const widgetsByBucket: Record<string, any[]> =
      prefs.widgets_by_bucket || {};
    for (const [bucket, widgets] of Object.entries(widgetsByBucket)) {
      const match = (widgets || []).find(
        (w: any) => w.id === "linked_task" && w.linkedTaskId === taskId,
      );
      if (match) return { widgetId: match.instanceId, bucket };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Toggle a task's "pinned to dashboard" widget.
 * If a linked_task widget exists → removes it. Otherwise → creates one.
 */
export async function togglePinToDashboard(opts: {
  taskId: string;
  taskTitle: string;
  taskSource?: string;
  taskBucket?: string;
  taskDueDate?: string;
  fallbackBucket?: string;
}): Promise<{
  status: "added" | "removed";
  bucket: string;
  widgetId: string | null;
}> {
  const {
    taskId,
    taskTitle,
    taskSource,
    taskBucket,
    taskDueDate,
    fallbackBucket = "General",
  } = opts;

  // Fetch current preferences
  const prefsRes = await fetch("/api/user/preferences", {
    credentials: "same-origin",
  });
  if (!prefsRes.ok) throw new Error("Failed to fetch preferences");
  const prefs = await prefsRes.json();
  const widgetsByBucket: Record<string, any[]> = {
    ...(prefs.widgets_by_bucket || {}),
  };

  // Check if already pinned — if so, remove
  for (const [bucket, widgets] of Object.entries(widgetsByBucket)) {
    const match = (widgets || []).find(
      (w: any) => w.id === "linked_task" && w.linkedTaskId === taskId,
    );
    if (match) {
      widgetsByBucket[bucket] = (widgets || []).filter(
        (w: any) => w.instanceId !== match.instanceId,
      );
      const saveRes = await fetch("/api/user/preferences", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgets_by_bucket: widgetsByBucket }),
      });
      if (!saveRes.ok) throw new Error("Failed to save preferences");
      invalidateAllPreferencesCaches();
      return { status: "removed", bucket, widgetId: null };
    }
  }

  // Not pinned — create a new linked_task widget
  const targetBucket = taskBucket || fallbackBucket;
  const instanceId = `task-link-${taskId}-${Date.now()}`;

  const newWidget = {
    id: "linked_task",
    instanceId,
    name: taskTitle,
    description: "Task shortcut",
    icon: "ListChecks",
    category: "tasks",
    color: "indigo",
    defaultTarget: 1,
    target: 1,
    unit: "task",
    units: ["task"],
    dataSource: "task",
    schedule: [true, true, true, true, true, true, true],
    createdAt: new Date().toISOString(),
    linkedTaskId: taskId,
    linkedTaskSource: taskSource || "supabase",
    linkedTaskAutoCreated: false,
    linkedTaskTitle: taskTitle,
    linkedTaskConfig: {
      enabled: true,
      title: taskTitle,
      bucket: targetBucket,
      dueDate: taskDueDate || undefined,
      startTime: undefined,
      endTime: undefined,
      allDay: true,
      repeat: "none",
    },
  };

  const existingBucketWidgets = widgetsByBucket[targetBucket] || [];
  widgetsByBucket[targetBucket] = [...existingBucketWidgets, newWidget];

  const saveRes = await fetch("/api/user/preferences", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ widgets_by_bucket: widgetsByBucket }),
  });
  if (!saveRes.ok) throw new Error("Failed to save preferences");
  invalidateAllPreferencesCaches();
  return { status: "added", bucket: targetBucket, widgetId: instanceId };
}
