"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import type { WidgetInstance } from "@/types/widgets";
import type { Task, RepeatOption } from "@/types/tasks";
import type { ProgressEntry } from "@/features/dashboard/types";
import type { DestructiveConfirmState } from "@/lib/dashboard-utils";
import { MODAL_WIDGET_IDS } from "@/features/dashboard/constants";
import { getUserPreferencesClient, updateUserPreferenceFields } from "@/lib/user-preferences";
import { buildTogglePayload } from "@/lib/habit-utils";
import { todayStrGlobal, yesterdayStrGlobal, debounce, migrateWidgetsToTemplates } from "@/lib/dashboard-utils";
import { ListChecks } from "lucide-react";
import type { DropResult } from "@hello-pangea/dnd";

interface UseDashboardWidgetsOptions {
  user: User | null;
  activeBucket: string;
  buckets: string[];
  bucketsRef: React.MutableRefObject<string[]>;
  /** Shared ref — orchestrator creates this before both bucket & widget hooks */
  widgetsByBucketRef: React.MutableRefObject<Record<string, WidgetInstance[]>>;
  /** Shared ref — orchestrator creates this before daily-reset and integration hooks */
  progressByWidgetRef: React.MutableRefObject<Record<string, ProgressEntry>>;
  selectedDate: Date;
  pushUndo: (message: string, onUndo: () => Promise<void> | void) => void;
  setConfirmState: React.Dispatch<React.SetStateAction<DestructiveConfirmState | null>>;
  allTasks: Task[];
  deleteTask: (taskId: string) => Promise<void>;
  contextCreateTask: (...args: any[]) => Promise<any>;
}

export function useDashboardWidgets({
  user,
  activeBucket,
  buckets,
  bucketsRef,
  widgetsByBucketRef,
  progressByWidgetRef,
  selectedDate,
  pushUndo,
  setConfirmState,
  allTasks,
  deleteTask,
  contextCreateTask,
}: UseDashboardWidgetsOptions) {
  // ── State ──────────────────────────────────────────────────────────────
  const [widgetsByBucket, setWidgetsByBucket] = useState<Record<string, WidgetInstance[]>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('widgets_by_bucket');
      if (stored) {
        const parsed = JSON.parse(stored);
        const widgets = (parsed.widgets && parsed.savedAt) ? parsed.widgets : parsed;
        if (widgets && typeof widgets === 'object' && !Array.isArray(widgets)) {
          const count = Object.values(widgets).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
          if (count > 0) return widgets;
        }
      }
    } catch { /* fall through */ }
    return {};
  });
  // Keep shared ref in sync
  widgetsByBucketRef.current = widgetsByBucket;

  const [isWidgetLoadComplete, setIsWidgetLoadComplete] = useState(false);

  const [progressByWidget, setProgressByWidget] = useState<Record<string, ProgressEntry>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem('widget_progress');
      if (raw) return JSON.parse(raw);
    } catch { /* fall through */ }
    return {};
  });
  // Keep shared ref in sync
  progressByWidgetRef.current = progressByWidget;

  // Dirty flag — prevents the useEffect watcher from writing back freshly-loaded data
  const isDirtyRef = useRef(false);

  // Editor state
  const [editingWidget, setEditingWidget] = useState<WidgetInstance | null>(null);
  const [editingBucket, setEditingBucket] = useState<string | null>(null);
  const [newlyCreatedWidgetId, setNewlyCreatedWidgetId] = useState<string | null>(null);

  // Modal state
  const [openWidgetModal, setOpenWidgetModal] = useState<string | null>(null);
  const [activeModalWidget, setActiveModalWidget] = useState<WidgetInstance | null>(null);
  const [isWidgetSheetOpen, setIsWidgetSheetOpen] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────
  function getDisplayWidgets(bucket: string) {
    const widgets = widgetsByBucket[bucket] ?? [];
    return widgets.filter((w) => !w.instanceId?.startsWith('debug-'));
  }

  const widgetTimeToHourSlot = (time?: string | null): string | undefined => {
    if (!time) return undefined;
    const [rawHour, rawMinute = "0"] = time.split(":");
    const hour = Number.parseInt(rawHour ?? "", 10);
    if (Number.isNaN(hour)) return undefined;
    const minute = Number.parseInt(rawMinute, 10);
    let adjustedHour = hour;
    if (minute >= 30) {
      adjustedHour = Math.min(23, hour + 1);
    }
    const displayHour = (adjustedHour % 12) || 12;
    const suffix = adjustedHour >= 12 ? "PM" : "AM";
    return `hour-${displayHour}${suffix}`;
  };

  // ── Memos ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeWidgets = useMemo(() => getDisplayWidgets(activeBucket), [widgetsByBucket, activeBucket]);

  const widgetProgressStats = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    activeWidgets.forEach(w => {
      const prog = progressByWidget[w.instanceId];
      const val = prog && prog.date === todayStrGlobal ? prog.value : 0;
      const target = w.target && w.target > 0 ? w.target : 1;
      if (val >= target) completed++;
      else if (val > 0) inProgress++;
      else notStarted++;
    });
    const pct = activeWidgets.length > 0 ? Math.round((completed / activeWidgets.length) * 100) : 0;
    return { completed, inProgress, notStarted, pct, total: activeWidgets.length };
  }, [activeWidgets, progressByWidget]);

  const activeWidgetMap = useMemo(() => {
    return new Map(activeWidgets.map((widget) => [widget.instanceId, widget]));
  }, [activeWidgets]);

  // O(1) task lookup map — built once per allTasks change
  const taskLookupMap = useMemo(
    () => new Map(allTasks.map(t => [t.id?.toString?.() ?? '', t])),
    [allTasks],
  );

  const linkedTaskDataByWidgetId = useMemo(() => {
    const linkedIds = activeWidgets
      .filter(w => w.linkedTaskId)
      .map(w => w.linkedTaskId!);
    if (linkedIds.length === 0) return {} as Record<string, { completed?: boolean; content?: string; dueDate?: string }>;
    const result: Record<string, { completed?: boolean; content?: string; dueDate?: string }> = {};
    for (const id of linkedIds) {
      const task = taskLookupMap.get(id);
      if (task) {
        result[id] = { completed: task.completed, content: task.content, dueDate: task.due?.date };
      }
    }
    return result;
  }, [activeWidgets, taskLookupMap]);

  const linkedTaskMap = useMemo(() => {
    const map: Record<string, { bucket: string; widgetId: string }> = {};
    Object.entries(widgetsByBucket).forEach(([bucketName, widgets]) => {
      (widgets || []).forEach((widget) => {
        if (widget?.linkedTaskId) {
          map[widget.linkedTaskId] = { bucket: bucketName, widgetId: widget.instanceId };
        }
      });
    });
    return map;
  }, [widgetsByBucket]);

  // ── Core persistence ──────────────────────────────────────────────────
  const saveWidgets = useCallback(async (
    widgetsToSave: Record<string, WidgetInstance[]>,
    progressToSave?: Record<string, ProgressEntry>,
  ) => {
    if (typeof window !== 'undefined') {
      try {
        const dataToSave = {
          widgets: widgetsToSave,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem('widgets_by_bucket', JSON.stringify(dataToSave));
      } catch (lsErr) {
        console.error('[saveWidgets] localStorage.setItem FAILED:', lsErr);
      }
    }

    try {
      const fields: Record<string, any> = { widgets_by_bucket: widgetsToSave };
      if (progressToSave && Object.keys(progressToSave).length > 0) {
        fields.progress_by_widget = progressToSave;
      } else if (progressByWidgetRef.current && Object.keys(progressByWidgetRef.current).length > 0) {
        fields.progress_by_widget = progressByWidgetRef.current;
      }
      const ok = await updateUserPreferenceFields(fields);
      if (!ok) {
        console.error('[saveWidgets] Supabase save returned false');
      }
    } catch (err) {
      console.error('[saveWidgets] Supabase save exception:', err);
    }
  }, [progressByWidgetRef]);

  const debouncedSaveToSupabase = useRef(
    debounce(() => {
      const latestWidgets = widgetsByBucketRef.current;
      const latestProgress = progressByWidgetRef.current;
      saveWidgets(latestWidgets, latestProgress);
    }, 2000)
  ).current;

  const flushDebouncedSave = useCallback(() => {
    debouncedSaveToSupabase.flush?.();
  }, [debouncedSaveToSupabase]);

  // ── Progress ──────────────────────────────────────────────────────────
  const incrementProgress = useCallback(async (w: WidgetInstance) => {
    isDirtyRef.current = true;
    setProgressByWidget(prev => {
      const entry = prev[w.instanceId] ?? { value: 0, date: todayStrGlobal, streak: 0, lastCompleted: '' };
      let { value, streak, lastCompleted } = entry;
      if (entry.date !== todayStrGlobal) {
        value = 0;
      }
      value += 1;
      let newLast = lastCompleted;
      let newStreak = streak;
      if (value >= w.target) {
        if (lastCompleted === yesterdayStrGlobal) {
          newStreak = streak + 1;
        } else if (lastCompleted !== todayStrGlobal) {
          newStreak = 1;
        }
        newLast = todayStrGlobal;

        if (value === w.target && typeof window !== 'undefined') {
          import('canvas-confetti').then((mod) => {
            const confetti = mod.default;
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
            });
          }).catch((err) => console.error('Failed to load confetti', err));
        }
      }

      return { ...prev, [w.instanceId]: { value, date: todayStrGlobal, streak: newStreak, lastCompleted: newLast } };
    });

    try {
      await fetch('/api/widgets/progress', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: [{
            widget_instance_id: w.instanceId,
            date: todayStrGlobal,
            value: (progressByWidgetRef.current[w.instanceId]?.value ?? 0) + 1,
          }],
        }),
      });
    } catch (err) {
      console.error('Failed to upsert progress history', err);
    }
  }, [progressByWidgetRef]);

  // ── Card / editor callbacks ───────────────────────────────────────────
  const handleCardClick = useCallback((widget: WidgetInstance) => {
    if (['water', 'steps', 'heartrate'].includes(widget.id) && widget.dataSource && widget.dataSource !== 'manual') {
      setEditingWidget(widget); setEditingBucket(activeBucket); setNewlyCreatedWidgetId(null);
      return;
    }
    if (MODAL_WIDGET_IDS.has(widget.id)) {
      setActiveModalWidget(widget);
      setOpenWidgetModal(widget.id);
    } else {
      setEditingWidget(widget);
      setEditingBucket(activeBucket);
      setNewlyCreatedWidgetId(null);
    }
  }, [activeBucket]);

  const handleEditSettings = useCallback((widget: WidgetInstance) => {
    setEditingWidget(widget);
    setEditingBucket(activeBucket);
    setNewlyCreatedWidgetId(null);
  }, [activeBucket]);

  // ── Widget drag reorder ───────────────────────────────────────────────
  const handleWidgetDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.index === destination.index) return;

    isDirtyRef.current = true;
    setWidgetsByBucket((prev) => {
      const bucketWidgets = [...(prev[activeBucket] || [])];
      const displayWidgets = bucketWidgets.filter(w => !w.instanceId?.startsWith('debug-'));
      const debugWidgets = bucketWidgets.filter(w => w.instanceId?.startsWith('debug-'));
      const [moved] = displayWidgets.splice(source.index, 1);
      displayWidgets.splice(destination.index, 0, moved);
      const updated = { ...prev, [activeBucket]: [...displayWidgets, ...debugWidgets] };
      widgetsByBucketRef.current = updated;
      return updated;
    });
  }, [activeBucket, widgetsByBucketRef]);

  // ── Widget modal update ───────────────────────────────────────────────
  const handleWidgetModalUpdate = useCallback((widget: WidgetInstance, updates: Partial<WidgetInstance>) => {
    isDirtyRef.current = true;
    setWidgetsByBucket(prev => {
      const next = { ...prev };
      // Find the widget's actual bucket instead of assuming activeBucket
      const targetBucket = Object.keys(next).find(bkt =>
        (next[bkt] ?? []).some(w => w.instanceId === widget.instanceId)
      ) ?? activeBucket;
      next[targetBucket] = (next[targetBucket] ?? []).map(w =>
        w.instanceId === widget.instanceId ? { ...w, ...updates } : w
      );
      return next;
    });
  }, [activeBucket]);

  // ── Habit toggle ──────────────────────────────────────────────────────
  const handleHabitToggle = useCallback((widget: WidgetInstance, isCompletedToday: boolean) => {
    const updatedData = buildTogglePayload(widget, isCompletedToday);
    if (!updatedData) return;

    if (!isCompletedToday) {
      incrementProgress(widget);
    }

    isDirtyRef.current = true;
    setWidgetsByBucket(prev => {
      const next = { ...prev };
      next[activeBucket] = (next[activeBucket] ?? []).map(ww =>
        ww.instanceId === widget.instanceId ? { ...ww, ...updatedData } : ww
      );
      return next;
    });
  }, [activeBucket, incrementProgress]);

  // ── Widget CRUD ───────────────────────────────────────────────────────
  const patchWidgetInActiveBucket = useCallback((widgetId: string, updates: Partial<WidgetInstance>) => {
    isDirtyRef.current = true;
    setWidgetsByBucket((prev) => {
      const updated = { ...prev };
      updated[activeBucket] = (updated[activeBucket] ?? []).map((widget) =>
        widget.instanceId === widgetId ? { ...widget, ...updates } : widget
      );
      widgetsByBucketRef.current = updated;
      return updated;
    });
  }, [activeBucket, widgetsByBucketRef]);

  const removeWidgetByIdImmediate = useCallback(async (widgetId: string) => {
    isDirtyRef.current = true;
    const nextWidgets: Record<string, WidgetInstance[]> = {};
    for (const [bucketName, widgets] of Object.entries(widgetsByBucketRef.current)) {
      nextWidgets[bucketName] = (widgets ?? []).filter(
        (widget) => widget.instanceId !== widgetId
      );
    }
    widgetsByBucketRef.current = nextWidgets;
    setWidgetsByBucket(nextWidgets);

    const { [widgetId]: _removedProgress, ...nextProgressState } = progressByWidgetRef.current;
    progressByWidgetRef.current = nextProgressState;
    setProgressByWidget(nextProgressState);

    await saveWidgets(nextWidgets, nextProgressState);
  }, [saveWidgets, widgetsByBucketRef, progressByWidgetRef]);

  const requestRemoveWidget = useCallback((widget: WidgetInstance) => {
    const bucketEntry = Object.entries(widgetsByBucketRef.current).find(([, bucketWidgets]) =>
      (bucketWidgets ?? []).some((entry) => entry.instanceId === widget.instanceId)
    );
    const widgetBucket = bucketEntry?.[0] || activeBucket || buckets[0] || "General";
    const progressSnapshot = progressByWidgetRef.current[widget.instanceId];

    setConfirmState({
      title: `Remove "${widget.name}" widget?`,
      description: "This widget will be removed from your dashboard. You can undo immediately after confirming.",
      confirmLabel: "Remove widget",
      onConfirm: async () => {
        await removeWidgetByIdImmediate(widget.instanceId);
        pushUndo(`Removed ${widget.name}`, async () => {
          let restoredWidgetsState: Record<string, WidgetInstance[]> | undefined;
          setWidgetsByBucket((prev) => {
            const updated = { ...prev };
            const existing = updated[widgetBucket] ?? [];
            const alreadyPresent = existing.some((entry) => entry.instanceId === widget.instanceId);
            updated[widgetBucket] = alreadyPresent ? existing : [...existing, widget];
            restoredWidgetsState = updated;
            widgetsByBucketRef.current = updated;
            return updated;
          });

          const restoredProgressState: Record<string, ProgressEntry> = {
            ...progressByWidgetRef.current,
          };
          if (progressSnapshot) {
            restoredProgressState[widget.instanceId] = progressSnapshot;
          } else {
            delete restoredProgressState[widget.instanceId];
          }
          progressByWidgetRef.current = restoredProgressState;
          setProgressByWidget(restoredProgressState);

          if (restoredWidgetsState) {
            await saveWidgets(restoredWidgetsState, restoredProgressState);
          }
        });
      },
    });
  }, [activeBucket, buckets, pushUndo, setConfirmState, removeWidgetByIdImmediate, saveWidgets, widgetsByBucketRef, progressByWidgetRef]);

  const resetWidgetProgress = useCallback(async (widget: WidgetInstance) => {
    isDirtyRef.current = true;
    const nextProgressState: Record<string, ProgressEntry> = {
      ...progressByWidgetRef.current,
      [widget.instanceId]: {
        value: 0,
        date: todayStrGlobal,
        streak: 0,
        lastCompleted: "",
      },
    };
    progressByWidgetRef.current = nextProgressState;
    setProgressByWidget(nextProgressState);
    await saveWidgets(widgetsByBucketRef.current, nextProgressState);
  }, [saveWidgets, widgetsByBucketRef, progressByWidgetRef]);

  const handleSaveWidget = useCallback((updated: WidgetInstance) => {
    if (!editingBucket) return;
    isDirtyRef.current = true;
    setWidgetsByBucket(prev => {
      const updatedState = { ...prev };
      updatedState[editingBucket] = (updatedState[editingBucket] ?? []).map(w =>
        w.instanceId === updated.instanceId ? updated : w
      );
      return updatedState;
    });
    setEditingWidget(null);
    setNewlyCreatedWidgetId(null);
  }, [editingBucket]);

  // ── Task-widget linking ───────────────────────────────────────────────
  const findWidgetForTask = useCallback((taskId: string) => {
    for (const [bucketName, widgets] of Object.entries(widgetsByBucketRef.current)) {
      const match = (widgets || []).find((widget) => widget.linkedTaskId === taskId);
      if (match) {
        return { bucket: bucketName, widget: match };
      }
    }
    return null;
  }, [widgetsByBucketRef]);

  const resolveWidgetBucket = useCallback(
    (widgetId: string, fallback?: string) => {
      if (fallback && fallback.trim().length > 0) {
        return fallback;
      }
      for (const [bucketName, widgets] of Object.entries(widgetsByBucketRef.current)) {
        if ((widgets || []).some((entry) => entry.instanceId === widgetId)) {
          return bucketName;
        }
      }
      return activeBucket;
    },
    [activeBucket, widgetsByBucketRef],
  );

  const toggleTaskWidgetLink = useCallback(async (task: Task, bucketOverride?: string) => {
    if (!task?.id) return;
    const taskId = task.id.toString();
    const existing = findWidgetForTask(taskId);

    if (existing) {
      let nextState: Record<string, WidgetInstance[]> | undefined;
      setWidgetsByBucket((prev) => {
        const updated = { ...prev };
        const currentWidgets = updated[existing.bucket] ?? [];
        updated[existing.bucket] = currentWidgets.filter(
          (widget) => widget.instanceId !== existing.widget.instanceId,
        );
        nextState = updated;
        return updated;
      });
      if (nextState) {
        widgetsByBucketRef.current = nextState;
        await saveWidgets(nextState, progressByWidgetRef.current);
      }
      return { status: "removed" as const, bucket: existing.bucket };
    }

    const candidateBuckets = [bucketOverride, task.bucket, activeBucket, buckets[0], "General"].filter(
      (value): value is string => Boolean(value && value.trim().length > 0),
    );
    const targetBucket = candidateBuckets[0] ?? "General";

    const newWidget: WidgetInstance = {
      id: "linked_task",
      name: task.content,
      description: "Task shortcut",
      icon: ListChecks,
      category: "tasks",
      color: "indigo",
      defaultTarget: 1,
      unit: "task",
      units: ["task"],
      instanceId: `task-link-${taskId}-${Date.now()}`,
      target: 1,
      schedule: [true, true, true, true, true, true, true],
      dataSource: "task",
      createdAt: new Date().toISOString(),
      linkedTaskId: taskId,
      linkedTaskSource: task.source,
      linkedTaskAutoCreated: false,
      linkedTaskTitle: task.content,
      linkedTaskConfig: {
        enabled: true,
        title: task.content,
        bucket: targetBucket,
        dueDate: task.due?.date ?? undefined,
        startTime: undefined,
        endTime: undefined,
        allDay: true,
        repeat: "none",
      },
    };

    let nextState: Record<string, WidgetInstance[]> | undefined;
    setWidgetsByBucket((prev) => {
      const updated = { ...prev };
      const bucketWidgets = updated[targetBucket] ?? [];
      const existingIndex = bucketWidgets.findIndex((widget) => widget.linkedTaskId === taskId);
      if (existingIndex >= 0) {
        bucketWidgets[existingIndex] = newWidget;
      } else {
        bucketWidgets.push(newWidget);
      }
      updated[targetBucket] = [...bucketWidgets];
      nextState = updated;
      return updated;
    });
    if (nextState) {
      widgetsByBucketRef.current = nextState;
      await saveWidgets(nextState, progressByWidgetRef.current);
    }
    return { status: "added" as const, bucket: targetBucket };
  }, [activeBucket, buckets, findWidgetForTask, saveWidgets, widgetsByBucketRef, progressByWidgetRef]);

  const handleToggleTaskWidget = useCallback(
    async (task: Task) => {
      await toggleTaskWidgetLink(task, activeBucket);
    },
    [activeBucket, toggleTaskWidgetLink],
  );

  // ── Convert widget ↔ task ─────────────────────────────────────────────
  const convertWidgetToTask = useCallback(async (widget: WidgetInstance, bucket: string) => {
    if (!widget) return;

    const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

    if (widget.linkedTaskId) {
      const shouldUnlink =
        typeof window === "undefined" ||
        window.confirm("Remove this widget from the Tasks tab?");
      if (!shouldUnlink) return;

      if (widget.linkedTaskAutoCreated && widget.linkedTaskId) {
        try {
          await deleteTask(widget.linkedTaskId);
        } catch (error) {
          console.error("Failed to delete auto-created task:", error);
        }
      }

      let nextState: Record<string, WidgetInstance[]> | undefined;
      setWidgetsByBucket((prev) => {
        const updated = { ...prev };
        const bucketName = resolveWidgetBucket(widget.instanceId, bucket);
        const resolvedBucket = bucketName && bucketName.length > 0 ? bucketName : activeBucket;
        if (!resolvedBucket) {
          nextState = updated;
          return updated;
        }
        const widgetsList = updated[resolvedBucket] ?? [];
        updated[resolvedBucket] = widgetsList.map((entry) => {
          if (entry.instanceId !== widget.instanceId) return entry;
          const sanitized = { ...entry };
          delete sanitized.linkedTaskId;
          delete sanitized.linkedTaskSource;
          delete sanitized.linkedTaskAutoCreated;
          delete sanitized.linkedTaskTitle;
          if (sanitized.linkedTaskConfig) {
            sanitized.linkedTaskConfig = {
              ...sanitized.linkedTaskConfig,
              enabled: false,
            };
          }
          return sanitized;
        });
        nextState = updated;
        return updated;
      });
      if (nextState) {
        widgetsByBucketRef.current = nextState;
        await saveWidgets(nextState, progressByWidgetRef.current);
      }
      return;
    }

    try {
      const config = widget.linkedTaskConfig ?? {};
      const taskContent = (config.title || widget.linkedTaskTitle || widget.name || "Widget Task").trim();
      const bucketName = resolveWidgetBucket(widget.instanceId, bucket);
      const targetBucket = bucketName && bucketName.length > 0 ? bucketName : activeBucket;
      const resolvedBucket = config.bucket?.trim() || targetBucket || undefined;
      const preferredDueDate = config.dueDate?.trim();
      const resolvedDueDate = preferredDueDate || selectedDateStr || null;
      const allDay = config.allDay ?? true;
      const hourSlot = allDay ? undefined : widgetTimeToHourSlot(config.startTime);
      const endHourSlot = allDay ? undefined : widgetTimeToHourSlot(config.endTime);
      const repeatRule = (config.repeat ?? "none") as RepeatOption;
      const newTask = await contextCreateTask(
        taskContent,
        resolvedDueDate,
        hourSlot,
        resolvedBucket,
        repeatRule,
        {
          endHourSlot,
          allDay,
          endDate: resolvedDueDate ?? undefined,
        },
      );
      if (!newTask) return;

      let nextState: Record<string, WidgetInstance[]> | undefined;
      setWidgetsByBucket((prev) => {
        const updated = { ...prev };
        const resolvedBucketTarget = targetBucket && targetBucket.length > 0 ? targetBucket : activeBucket;
        if (!resolvedBucketTarget) {
          nextState = updated;
          return updated;
        }
        const widgetsList = updated[resolvedBucketTarget] ?? [];
        updated[resolvedBucketTarget] = widgetsList.map((entry) => {
          if (entry.instanceId !== widget.instanceId) return entry;
          return {
            ...entry,
            linkedTaskId: newTask.id?.toString?.() ?? newTask.id,
            linkedTaskSource: newTask.source,
            linkedTaskAutoCreated: true,
            linkedTaskTitle: newTask.content,
            linkedTaskConfig: {
              ...entry.linkedTaskConfig,
              enabled: true,
              title: taskContent,
              bucket: resolvedBucket,
              dueDate: resolvedDueDate ?? undefined,
              startTime: config.startTime,
              endTime: config.endTime,
              allDay,
              repeat: repeatRule,
            },
          };
        });
        nextState = updated;
        return updated;
      });
      if (nextState) {
        widgetsByBucketRef.current = nextState;
        await saveWidgets(nextState, progressByWidgetRef.current);
      }
    } catch (error) {
      console.error("Failed to convert widget to task:", error);
    }
  }, [activeBucket, selectedDate, deleteTask, contextCreateTask, resolveWidgetBucket, saveWidgets, widgetsByBucketRef, progressByWidgetRef]);

  // ── Load widgets ──────────────────────────────────────────────────────
  const loadWidgetsInProgress = useRef(false);

  const loadWidgets = useCallback(async () => {
    if (loadWidgetsInProgress.current) return;
    loadWidgetsInProgress.current = true;

    setIsWidgetLoadComplete(false);

    let loadedFromLocal = false;
    let localWidgets: Record<string, WidgetInstance[]> = {};

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('widgets_by_bucket');
        if (stored) {
          const parsed = JSON.parse(stored);

          if (parsed.widgets && parsed.savedAt) {
            localWidgets = parsed.widgets;
          } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            localWidgets = parsed;
          }

          const localCount = Object.values(localWidgets).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

          if (localCount > 0) {
            setWidgetsByBucket(localWidgets);
            loadedFromLocal = true;
          }
        }
      } catch (e) {
        console.error('Failed to parse stored widgets', e);
      }
    }

    try {
      const prefs = await getUserPreferencesClient();

      const supabaseWidgets: Record<string, WidgetInstance[]> = prefs?.widgets_by_bucket ?? {};
      const sbCount = Object.values(supabaseWidgets).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      const hasSupabase = sbCount > 0;
      const localCount = Object.values(localWidgets).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      const hasLocal = loadedFromLocal && localCount > 0;

      if (hasSupabase || hasLocal) {
        const merged: Record<string, WidgetInstance[]> = {};
        const allBucketKeys = Array.from(new Set([
          ...Object.keys(supabaseWidgets),
          ...Object.keys(localWidgets),
        ]));
        let mergedDiffersFromSupabase = false;

        for (const bkt of allBucketKeys) {
          const sbList: WidgetInstance[] = supabaseWidgets[bkt] ?? [];
          const localList: WidgetInstance[] = localWidgets[bkt] ?? [];

          if (hasSupabase) {
            const localById = new Map<string, WidgetInstance>();
            for (const w of localList) {
              if (w && w.instanceId) localById.set(w.instanceId, w);
            }

            const byId = new Map<string, WidgetInstance>();
            for (const w of sbList) {
              if (w && w.instanceId) {
                byId.set(w.instanceId, localById.get(w.instanceId) || w);
              }
            }

            merged[bkt] = Array.from(byId.values());
          } else {
            const byId = new Map<string, WidgetInstance>();
            for (const w of localList) {
              if (w && w.instanceId) byId.set(w.instanceId, w);
            }
            merged[bkt] = Array.from(byId.values());
          }

          if (merged[bkt].length !== sbList.length) {
            mergedDiffersFromSupabase = true;
          }
        }

        const migratedMerged = migrateWidgetsToTemplates(merged);

        const currentBuckets = new Set(bucketsRef.current);
        let removedStaleBuckets = false;
        if (currentBuckets.size > 0) {
          const fallbackBucket = bucketsRef.current[0] ?? "General";
          for (const key of Object.keys(migratedMerged)) {
            if (!currentBuckets.has(key)) {
              // Rescue orphaned widgets into fallback bucket instead of deleting
              const orphaned = migratedMerged[key] ?? [];
              if (orphaned.length > 0) {
                if (!migratedMerged[fallbackBucket]) {
                  migratedMerged[fallbackBucket] = [];
                }
                migratedMerged[fallbackBucket].push(...orphaned);
              }
              delete migratedMerged[key];
              removedStaleBuckets = true;
            }
          }
        }

        setWidgetsByBucket(migratedMerged);
        widgetsByBucketRef.current = migratedMerged;

        setIsWidgetLoadComplete(true);
        loadWidgetsInProgress.current = false;

        if (typeof window !== 'undefined') {
          localStorage.setItem('widgets_by_bucket', JSON.stringify({
            widgets: migratedMerged,
            savedAt: new Date().toISOString(),
          }));
        }
        if (mergedDiffersFromSupabase || removedStaleBuckets) {
          void updateUserPreferenceFields({ widgets_by_bucket: migratedMerged });
        }
      }
    } catch (err) {
      console.error('Failed to load widgets from preferences', err);
    } finally {
      setIsWidgetLoadComplete(true);
      loadWidgetsInProgress.current = false;
    }
  }, [bucketsRef, widgetsByBucketRef]);

  // ── Debug cleanup ─────────────────────────────────────────────────────
  const cleanupDebugWidgets = useCallback(async () => {
    const cleaned: Record<string, WidgetInstance[]> = {};
    Object.entries(widgetsByBucketRef.current).forEach(([bkt, widgets]) => {
      cleaned[bkt] = widgets.filter(w => !w.instanceId?.startsWith('debug-'));
    });
    isDirtyRef.current = true;
    setWidgetsByBucket(cleaned);
    await saveWidgets(cleaned);
  }, [widgetsByBucketRef, saveWidgets]);

  // ── Effects ───────────────────────────────────────────────────────────

  // Load progress from localStorage or Supabase once on mount / user change
  useEffect(() => {
    async function loadProgress() {
      let loaded = false;
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('widget_progress');
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setProgressByWidget(parsed);
            loaded = true;
          } catch (e) {
            console.error('Failed to parse localStorage progress:', e);
          }
        }
      }

      if (!loaded && user) {
        try {
          const prefs = await getUserPreferencesClient();
          if (prefs?.progress_by_widget) {
            setProgressByWidget(prefs.progress_by_widget as Record<string, ProgressEntry>);
          }
        } catch (err) {
          console.error('Failed to load progress from Supabase', err);
        }
      }
    }

    loadProgress();
  }, [user]);

  // Save widgets whenever they change
  useEffect(() => {
    if (!isWidgetLoadComplete || !user) return;
    if (!isDirtyRef.current) return;

    const widgetCount = Object.values(widgetsByBucket).reduce(
      (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0
    );
    if (widgetCount === 0) {
      const existing = typeof window !== 'undefined' ? localStorage.getItem('widgets_by_bucket') : null;
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          const existingWidgets = parsed.widgets || parsed;
          const existingCount = Object.values(existingWidgets).reduce(
            (sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0
          );
          if (existingCount > 0) {
            console.warn('[saveWidgets] Skipping save — would overwrite', existingCount, 'existing widgets with empty state');
            return;
          }
        } catch { /* ignore parse errors */ }
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('widgets_by_bucket', JSON.stringify({
        widgets: widgetsByBucket,
        savedAt: new Date().toISOString(),
      }));
    }

    debouncedSaveToSupabase();
  }, [widgetsByBucket, isWidgetLoadComplete, user, debouncedSaveToSupabase]);

  // Save progress whenever it changes
  useEffect(() => {
    if (!isWidgetLoadComplete || !user) return;
    if (!isDirtyRef.current) return;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('widget_progress', JSON.stringify(progressByWidget));
      } catch (e) {
        console.error('Failed to persist widget progress', e);
      }
    }

    debouncedSaveToSupabase();
  }, [progressByWidget, isWidgetLoadComplete, user, debouncedSaveToSupabase]);

  // Flush debounced saves before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      debouncedSaveToSupabase.flush?.();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [debouncedSaveToSupabase]);

  return {
    // State
    widgetsByBucket, setWidgetsByBucket,
    isWidgetLoadComplete, setIsWidgetLoadComplete,
    progressByWidget, setProgressByWidget,
    editingWidget, setEditingWidget,
    editingBucket, setEditingBucket,
    newlyCreatedWidgetId, setNewlyCreatedWidgetId,
    openWidgetModal, setOpenWidgetModal,
    activeModalWidget, setActiveModalWidget,
    isWidgetSheetOpen, setIsWidgetSheetOpen,
    // Memos
    activeWidgets,
    widgetProgressStats,
    activeWidgetMap,
    linkedTaskDataByWidgetId,
    linkedTaskMap,
    // Functions
    loadWidgets,
    saveWidgets,
    flushDebouncedSave,
    debouncedSaveToSupabase,
    incrementProgress,
    handleCardClick,
    handleEditSettings,
    handleWidgetDragEnd,
    handleWidgetModalUpdate,
    handleHabitToggle,
    handleSaveWidget,
    patchWidgetInActiveBucket,
    removeWidgetByIdImmediate,
    requestRemoveWidget,
    resetWidgetProgress,
    findWidgetForTask,
    toggleTaskWidgetLink,
    handleToggleTaskWidget,
    resolveWidgetBucket,
    convertWidgetToTask,
    getDisplayWidgets,
    cleanupDebugWidgets,
  };
}
