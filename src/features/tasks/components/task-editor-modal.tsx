"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import { format, parseISO } from "date-fns";
import { X, Trash2, ShoppingCart } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTaskData, useTaskActions } from "@/contexts/tasks-context";
import type { RepeatOption, Task } from "@/types/tasks";
import {
  deriveRepeatOption,
  extractHourLabel,
  sanitizeBucketName,
  UNASSIGNED_BUCKET_LABEL,
} from "@/lib/task-form-utils";
import { cn } from "@/lib/utils";
import { getBucketColorSync } from "@/lib/bucket-colors";

function generateHourLabels(startHour: number, endHour: number): string[] {
  const labels: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    const display = h % 12 || 12;
    const suffix = h < 12 ? "AM" : "PM";
    labels.push(`${display}${suffix}`);
  }
  return labels;
}
const START_HOURS = generateHourLabels(7, 21);  // 7AM – 9PM
const END_HOURS = generateHourLabels(7, 22);    // 7AM – 10PM
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

/** Compose "2PM" + "15" → "2:15PM"; "2PM" + "00" → "2PM" */
const composeTimeLabel = (hour: string, minute: string): string => {
  if (!hour) return "";
  if (!minute || minute === "00") return hour;
  const match = hour.match(/^(\d{1,2})(AM|PM)$/);
  if (!match) return hour;
  return `${match[1]}:${minute}${match[2]}`;
};

/** Decompose "2:15PM" → { hour: "2PM", minute: "15" }; "2PM" → { hour: "2PM", minute: "00" } */
const decomposeTimeLabel = (label: string): { hour: string; minute: string } => {
  if (!label) return { hour: "", minute: "00" };
  const match = label.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/);
  if (!match) return { hour: "", minute: "00" };
  return { hour: `${match[1]}${match[3]}`, minute: match[2] || "00" };
};

type TaskEditorOpenOptions = {
  fallbackTitle?: string;
  fallbackHourLabel?: string;
  fallbackTaskId?: string;
  fallbackRepeat?: RepeatOption | null;
  fallbackBucket?: string;
  fallbackEndDate?: string;
  fallbackEndHourLabel?: string;
  fallbackAllDay?: boolean;
  fallbackAssigneeId?: string | null;
};

type OpenByIdMetadata = {
  hourSlot?: string | null;
  plannerDate?: string | null;
};

export interface TaskEditorModalHandle {
  openWithTask: (task: Task | undefined, dateStr: string, options?: TaskEditorOpenOptions) => void;
  openByTaskId: (taskId: string, metadata?: OpenByIdMetadata) => void;
  openNew: (dateStr: string, options?: Partial<TaskEditorOpenOptions>) => void;
  close: () => void;
}

export interface FamilyMemberOption {
  id: string;
  name: string;
  avatarColor: string;
  relationship: string;
}

interface TaskEditorModalProps {
  availableBuckets?: string[];
  selectedBucket?: string | null;
  getDefaultDate?: () => string;
  onSubmitSuccess?: (result: { action: "create" | "update"; taskId?: string | null; date: string }) => void;
  bucketColors?: Record<string, string>;
  familyMembers?: FamilyMemberOption[];
}

const toHourSlot = (label: string): string | null => {
  if (!label) return null;
  return label.startsWith("hour-") ? label : `hour-${label}`;
};

const resolveTodayKey = () => format(new Date(), "yyyy-MM-dd");

const TaskEditorModal = forwardRef<TaskEditorModalHandle, TaskEditorModalProps>(
  ({ availableBuckets = [], selectedBucket, getDefaultDate, onSubmitSuccess, bucketColors = {}, familyMembers = [] }, ref) => {
    const { allTasks } = useTaskData();
    const { createTask, batchUpdateTasks, deleteTask, refetch } = useTaskActions();
    const { toast } = useToast();
    const vvHeight = useVisualViewport();

    const [isOpen, setIsOpen] = useState(false);
    const [formContent, setFormContent] = useState("");
    const [formBucket, setFormBucket] = useState<string>(sanitizeBucketName(selectedBucket) ?? sanitizeBucketName(availableBuckets[0]) ?? "");
    const [formTime, setFormTime] = useState("");
    const [formEndTime, setFormEndTime] = useState("");
    const [formAllDay, setFormAllDay] = useState(true);
    const [formRepeat, setFormRepeat] = useState<RepeatOption>("none");
    const [formEndDate, setFormEndDate] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editTaskId, setEditTaskId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [shoppingItemId, setShoppingItemId] = useState<string | null>(null);
    const [isShoppingBusy, setIsShoppingBusy] = useState(false);
    const [formAssignee, setFormAssignee] = useState<string | null>(null);

    const resolveDefaultDate = useCallback(() => {
      return getDefaultDate?.() ?? resolveTodayKey();
    }, [getDefaultDate]);

    const evaluateBucketDefault = useCallback(() => {
      return sanitizeBucketName(selectedBucket) ?? sanitizeBucketName(availableBuckets[0]) ?? "";
    }, [availableBuckets, selectedBucket]);

    const resetState = useCallback(() => {
      setIsOpen(false);
      setEditTaskId(null);
      setFormContent("");
      setFormTime("");
      setFormEndTime("");
      setFormAllDay(true);
      setFormRepeat("none");
      setStartDate(null);
      setFormEndDate(null);
      setIsSubmitting(false);
      setFormBucket(evaluateBucketDefault());
      setShowDeleteConfirm(false);
      setShoppingItemId(null);
      setIsShoppingBusy(false);
      setFormAssignee(null);
    }, [evaluateBucketDefault]);

    const ensureTaskLookup = useCallback((taskId?: string | null): Task | undefined => {
      if (!taskId) return undefined;
      const lookup = taskId.toString();
      return allTasks.find((task) => task.id?.toString?.() === lookup);
    }, [allTasks]);

    const openWithTask = useCallback((task: Task | undefined, dateStr: string, options: TaskEditorOpenOptions = {}) => {
      const effectiveDate = dateStr || task?.startDate || task?.due?.date || resolveDefaultDate();
      const fallbackEndDate = options.fallbackEndDate ?? task?.endDate ?? effectiveDate;
      const bucketDefault = evaluateBucketDefault();
      const hourLabel = extractHourLabel(task?.hourSlot) || extractHourLabel(options.fallbackHourLabel) || "";
      const endHourLabel = extractHourLabel(task?.endHourSlot) || extractHourLabel(options.fallbackEndHourLabel) || "";
      const repeatDefault = task ? deriveRepeatOption(task) : (options.fallbackRepeat ?? "none");
      const sanitizedTaskBucket = sanitizeBucketName(task?.bucket);
      const sanitizedFallbackBucket = sanitizeBucketName(options.fallbackBucket);
      const editingExisting = Boolean(task?.id ?? options.fallbackTaskId);
      const resolvedBucket =
        sanitizedTaskBucket ??
        sanitizedFallbackBucket ??
        (editingExisting ? "" : bucketDefault);

      setFormContent(task?.content ?? options.fallbackTitle ?? "");
      setFormBucket(resolvedBucket);
      setFormTime(hourLabel);
      setFormEndTime(endHourLabel);
      setFormAllDay(task?.allDay ?? options.fallbackAllDay ?? (!hourLabel && !endHourLabel));
      setFormRepeat(repeatDefault);
      setStartDate(effectiveDate);
      setFormEndDate(fallbackEndDate);
      setEditTaskId(task?.id?.toString?.() ?? options.fallbackTaskId ?? null);
      setFormAssignee(task?.assigneeId ?? options.fallbackAssigneeId ?? null);
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
      setIsOpen(true);
    }, [evaluateBucketDefault, resolveDefaultDate]);

    const openByTaskId = useCallback((taskId: string, metadata?: OpenByIdMetadata) => {
      const task = ensureTaskLookup(taskId);
      const fallbackHour = extractHourLabel(metadata?.hourSlot) || extractHourLabel(task?.hourSlot);
      const plannerDate = metadata?.plannerDate || task?.startDate || task?.due?.date || resolveDefaultDate();
      openWithTask(task, plannerDate, {
        fallbackTaskId: taskId,
        fallbackHourLabel: fallbackHour,
        fallbackRepeat: task?.repeatRule ?? null,
        fallbackBucket: task?.bucket,
        fallbackAllDay: task?.allDay,
      });
    }, [ensureTaskLookup, openWithTask, resolveDefaultDate]);

    const openNew = useCallback((dateStr: string, options?: Partial<TaskEditorOpenOptions>) => {
      openWithTask(undefined, dateStr, options);
    }, [openWithTask]);

    useImperativeHandle(ref, () => ({
      openWithTask,
      openByTaskId,
      openNew,
      close: resetState,
    }), [openWithTask, openByTaskId, openNew, resetState]);

    useEffect(() => {
      if (!isOpen || !editTaskId) {
        setShoppingItemId(null);
        return;
      }
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch(
            `/api/shopping-list?taskId=${encodeURIComponent(editTaskId)}&includePurchased=true`,
            { credentials: "same-origin" },
          );
          if (!res.ok || cancelled) return;
          const json = await res.json();
          if (!cancelled && json.items?.length > 0) {
            setShoppingItemId(json.items[0].id);
          }
        } catch {
          // silently ignore — button defaults to "add" mode
        }
      })();
      return () => { cancelled = true; };
    }, [isOpen, editTaskId]);

    useEffect(() => {
      if (!startDate) {
        return;
      }
      setFormEndDate((prev) => {
        if (!prev || prev < startDate) {
          return startDate;
        }
        return prev;
      });
    }, [startDate]);

    const handleSubmit = useCallback(async () => {
      if (!formContent.trim() || isSubmitting) return;

      const toHourNumber = (label: string): number | undefined => {
        if (!label) return undefined;
        const match = label.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/);
        if (!match) return undefined;
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const period = match[3];
        if (period === "PM" && hours !== 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        return hours + minutes / 60;
      };

      const hourNum = toHourNumber(formTime);
      const endHourNum = toHourNumber(formEndTime);
      const rawStartDate = startDate && startDate.trim() ? startDate : null;
      const resolvedStartDate = rawStartDate ?? resolveDefaultDate();
      const rawEndDate = formEndDate && formEndDate.trim() ? formEndDate : null;
      let resolvedEndDate = rawEndDate ?? resolvedStartDate;
      if (resolvedStartDate && resolvedEndDate && resolvedEndDate < resolvedStartDate) {
        resolvedEndDate = resolvedStartDate;
      }
      const isAllDayEvent = formAllDay;
      const bucketValue = availableBuckets.length > 0 ? (formBucket || undefined) : undefined;

      setIsSubmitting(true);
      try {
        if (!editTaskId) {
          const task = await createTask(
            formContent.trim(),
            resolvedStartDate,
            isAllDayEvent ? null : hourNum,
            bucketValue,
            formRepeat,
            {
              endDate: resolvedEndDate,
              endHourSlot: isAllDayEvent ? null : endHourNum,
              allDay: isAllDayEvent,
              assigneeId: formAssignee,
            }
          );
          resetState();
          try {
            await refetch();
          } catch (error) {
            console.error("Failed to refresh tasks after creation", error);
          }
          onSubmitSuccess?.({
            action: "create",
            taskId: task?.id ?? null,
            date: resolvedStartDate,
          });
        } else {
          const updates: any = {
            content: formContent.trim(),
            startDate: resolvedStartDate,
            endDate: resolvedEndDate,
            allDay: isAllDayEvent,
            due: resolvedStartDate ? { date: resolvedStartDate } : null,
            repeatRule: formRepeat === "none" ? null : formRepeat,
            assigneeId: formAssignee,
          };
          if (bucketValue !== undefined) {
            updates.bucket = bucketValue || null;
          }
          updates.hourSlot = isAllDayEvent ? null : toHourSlot(formTime);
          updates.endHourSlot = isAllDayEvent ? null : toHourSlot(formEndTime);

          await batchUpdateTasks([{
            taskId: editTaskId,
            updates,
            occurrenceDate: resolvedStartDate,
          }]);

          resetState();
          try {
            await refetch();
          } catch (error) {
            console.error("Failed to refresh tasks after update", error);
          }
          onSubmitSuccess?.({
            action: "update",
            taskId: editTaskId,
            date: resolvedStartDate,
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    }, [
      formContent,
      isSubmitting,
      formTime,
      formEndTime,
      startDate,
      resolveDefaultDate,
      formEndDate,
      formAllDay,
      availableBuckets.length,
      formBucket,
      formRepeat,
      formAssignee,
      editTaskId,
      createTask,
      resetState,
      refetch,
      onSubmitSuccess,
      batchUpdateTasks,
    ]);

    const handleDelete = useCallback(async () => {
      if (!editTaskId) return;
      try {
        await deleteTask(editTaskId);
        resetState();
        try {
          await refetch();
        } catch {}
      } catch (error) {
        console.error("Failed to delete task", error);
      }
    }, [editTaskId, deleteTask, resetState, refetch]);

    const handleToggleShoppingList = useCallback(async () => {
      if (!editTaskId || isShoppingBusy) return;
      setIsShoppingBusy(true);
      try {
        if (shoppingItemId) {
          // Remove from shopping list
          const res = await fetch("/api/shopping-list", {
            method: "DELETE",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: shoppingItemId }),
          });
          if (!res.ok) throw new Error("Failed to remove shopping item");
          setShoppingItemId(null);
          toast({ title: "Removed from shopping list" });
        } else {
          // Add to shopping list
          const createRes = await fetch("/api/shopping-list", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: formContent.trim() || "Untitled",
              bucket: formBucket || null,
              neededBy: startDate ?? null,
            }),
          });
          if (!createRes.ok) throw new Error("Failed to create shopping item");
          const { item } = await createRes.json();

          if (item?.id) {
            await fetch("/api/shopping-list", {
              method: "PATCH",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: item.id,
                taskId: editTaskId,
                taskCreatedAt: new Date().toISOString(),
              }),
            });
            setShoppingItemId(item.id);
          }

          toast({ title: "Added to shopping list" });
        }
      } catch (err) {
        console.error("Failed to update shopping list:", err);
        toast({ title: "Failed to update shopping list", type: "error" });
      } finally {
        setIsShoppingBusy(false);
      }
    }, [editTaskId, isShoppingBusy, shoppingItemId, formContent, formBucket, startDate, toast]);

    // Keyboard shortcuts: Cmd+Enter to save, Escape to close
    useEffect(() => {
      if (!isOpen) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          resetState();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          handleSubmit();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, resetState, handleSubmit]);

    const modalDateLabel = useMemo(() => {
      if (!startDate) return "No date selected";
      try {
        return format(parseISO(startDate), "EEEE, MMMM d, yyyy");
      } catch {
        return startDate;
      }
    }, [startDate]);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50" onClick={resetState}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/25 animate-in fade-in duration-200" />

        {/* Centered modal */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div
            className="w-full max-w-[520px] bg-white rounded-2xl shadow-[0px_16px_48px_rgba(0,0,0,0.12)] animate-in fade-in zoom-in-95 duration-200 ease-out flex flex-col"
            style={{ maxHeight: vvHeight ? `${vvHeight * 0.9}px` : '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-theme-neutral-300/50 shrink-0">
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold text-theme-text-primary">
                {editTaskId ? "Edit Task" : "New Task"}
              </h3>
              <p className="text-xs text-theme-text-tertiary mt-0.5 truncate">{modalDateLabel}</p>
            </div>
            <button
              onClick={resetState}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-theme-text-tertiary hover:bg-theme-brand-tint-light hover:text-theme-text-secondary transition-colors shrink-0 ml-4"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
            {/* Task Name */}
            <div>
              <label className="block text-[11px] tracking-[0.6px] uppercase text-theme-text-tertiary font-medium mb-2">
                Task
              </label>
              <input
                autoFocus
                className="w-full border border-theme-neutral-300 rounded-lg px-3 py-2.5 text-sm text-theme-text-primary placeholder:text-theme-neutral-400 focus:outline-none focus:ring-2 focus:ring-theme-focus/30 focus:border-theme-primary transition-colors"
                placeholder="What needs to be done?"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
              />
            </div>

            {/* Schedule Section */}
            <div>
              <label className="block text-[11px] tracking-[0.6px] uppercase text-theme-text-tertiary font-medium mb-2">
                Schedule
              </label>
              <div className="rounded-xl border border-theme-neutral-300 overflow-hidden">
                {/* Start row */}
                <div className="grid grid-cols-2">
                  <div className="p-3">
                    <span className="text-[11px] text-theme-text-tertiary mb-1.5 block">Starts</span>
                    <input
                      type="date"
                      className="w-full text-[13px] text-theme-text-primary bg-transparent focus:outline-none"
                      value={startDate ?? ""}
                      onChange={(e) => setStartDate(e.target.value || null)}
                    />
                  </div>
                  <div className="p-3 border-l border-theme-neutral-300/50">
                    <span className="text-[11px] text-theme-text-tertiary mb-1.5 block">Time</span>
                    <div className="flex items-center gap-1">
                      <select
                        className="w-[58px] text-[13px] text-theme-text-primary bg-transparent focus:outline-none disabled:text-theme-neutral-400"
                        value={decomposeTimeLabel(formTime).hour}
                        onChange={(e) => {
                          const h = e.target.value;
                          if (!h) { setFormTime(""); return; }
                          const { minute } = decomposeTimeLabel(formTime);
                          setFormTime(composeTimeLabel(h, minute));
                        }}
                        disabled={formAllDay}
                      >
                        <option value="">--</option>
                        {START_HOURS.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <span className="text-[13px] text-theme-text-tertiary">:</span>
                      <select
                        className="w-[44px] text-[13px] text-theme-text-primary bg-transparent focus:outline-none disabled:text-theme-neutral-400"
                        value={decomposeTimeLabel(formTime).minute}
                        onChange={(e) => {
                          const { hour } = decomposeTimeLabel(formTime);
                          if (!hour) return;
                          setFormTime(composeTimeLabel(hour, e.target.value));
                        }}
                        disabled={formAllDay || !decomposeTimeLabel(formTime).hour}
                      >
                        {MINUTE_OPTIONS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                {/* End row */}
                <div className="grid grid-cols-2 border-t border-theme-neutral-300/50">
                  <div className="p-3">
                    <span className="text-[11px] text-theme-text-tertiary mb-1.5 block">Ends</span>
                    <input
                      type="date"
                      className="w-full text-[13px] text-theme-text-primary bg-transparent focus:outline-none"
                      value={formEndDate ?? startDate ?? ""}
                      min={startDate ?? undefined}
                      onChange={(e) => setFormEndDate(e.target.value || null)}
                    />
                  </div>
                  <div className="p-3 border-l border-theme-neutral-300/50">
                    <span className="text-[11px] text-theme-text-tertiary mb-1.5 block">Time</span>
                    <div className="flex items-center gap-1">
                      <select
                        className="w-[58px] text-[13px] text-theme-text-primary bg-transparent focus:outline-none disabled:text-theme-neutral-400"
                        value={decomposeTimeLabel(formEndTime).hour}
                        onChange={(e) => {
                          const h = e.target.value;
                          if (!h) { setFormEndTime(""); return; }
                          const { minute } = decomposeTimeLabel(formEndTime);
                          setFormEndTime(composeTimeLabel(h, minute));
                        }}
                        disabled={formAllDay}
                      >
                        <option value="">--</option>
                        {END_HOURS.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <span className="text-[13px] text-theme-text-tertiary">:</span>
                      <select
                        className="w-[44px] text-[13px] text-theme-text-primary bg-transparent focus:outline-none disabled:text-theme-neutral-400"
                        value={decomposeTimeLabel(formEndTime).minute}
                        onChange={(e) => {
                          const { hour } = decomposeTimeLabel(formEndTime);
                          if (!hour) return;
                          setFormEndTime(composeTimeLabel(hour, e.target.value));
                        }}
                        disabled={formAllDay || !decomposeTimeLabel(formEndTime).hour}
                      >
                        {MINUTE_OPTIONS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                {/* All day toggle */}
                <div className="px-3 py-2.5 border-t border-theme-neutral-300/50 bg-[rgba(252,250,248,0.5)]">
                  <label className="inline-flex items-center text-xs text-theme-text-secondary select-none cursor-pointer">
                    <input
                      type="checkbox"
                      className="mr-2 h-3.5 w-3.5 rounded border-theme-neutral-300 accent-theme-primary"
                      checked={formAllDay}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormAllDay(checked);
                        if (checked) {
                          setFormTime("");
                          setFormEndTime("");
                        }
                      }}
                    />
                    All day
                  </label>
                </div>
              </div>
            </div>

            {/* Category — Visual bucket picker */}
            {availableBuckets.length > 0 && (
              <div>
                <label className="block text-[11px] tracking-[0.6px] uppercase text-theme-text-tertiary font-medium mb-2">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFormBucket("")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] transition-all",
                      !formBucket
                        ? "bg-theme-brand-tint border-theme-primary/35 text-theme-text-primary font-medium"
                        : "bg-white border-[#e2e8f0] text-theme-text-secondary hover:border-[#cbd5e1]"
                    )}
                  >
                    <span className="w-2 h-2 rounded-full bg-theme-neutral-400" />
                    {UNASSIGNED_BUCKET_LABEL}
                  </button>
                  {availableBuckets.map((bucket) => {
                    const color = getBucketColorSync(bucket, bucketColors);
                    const active = formBucket === bucket;
                    return (
                      <button
                        type="button"
                        key={bucket}
                        onClick={() => setFormBucket(bucket)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] transition-all",
                          active
                            ? "bg-theme-brand-tint border-theme-primary/35 text-theme-text-primary font-medium"
                            : "bg-white border-[#e2e8f0] text-theme-text-secondary hover:border-[#cbd5e1]"
                        )}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        {bucket}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Assign to */}
            {familyMembers.length > 0 && (
              <div>
                <label className="block text-[11px] tracking-[0.6px] uppercase text-theme-text-tertiary font-medium mb-2">
                  Assign to
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFormAssignee(null)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] transition-all",
                      !formAssignee
                        ? "bg-theme-brand-tint border-theme-primary/35 text-theme-text-primary font-medium"
                        : "bg-white border-[#e2e8f0] text-theme-text-secondary hover:border-[#cbd5e1]"
                    )}
                  >
                    None
                  </button>
                  {familyMembers.map((member) => {
                    const active = formAssignee === member.id;
                    const initials = member.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    return (
                      <button
                        type="button"
                        key={member.id}
                        onClick={() => setFormAssignee(member.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] transition-all",
                          active
                            ? "bg-theme-brand-tint border-theme-primary/35 text-theme-text-primary font-medium"
                            : "bg-white border-[#e2e8f0] text-theme-text-secondary hover:border-[#cbd5e1]"
                        )}
                      >
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-2xs font-semibold text-white shrink-0"
                          style={{ backgroundColor: member.avatarColor }}
                        >
                          {initials}
                        </span>
                        {member.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Repeat */}
            <div>
              <label className="block text-[11px] tracking-[0.6px] uppercase text-theme-text-tertiary font-medium mb-2">
                Repeat
              </label>
              <select
                className="w-full border border-theme-neutral-300 rounded-lg px-3 py-2.5 text-[13px] text-theme-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-theme-focus/30 focus:border-theme-primary transition-colors"
                value={formRepeat}
                onChange={(e) => setFormRepeat(e.target.value as RepeatOption)}
              >
                <option value="none">Do not repeat</option>
                <option value="daily">Every day</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-theme-neutral-300/50 bg-[rgba(252,250,248,0.5)] shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {editTaskId && (
                  showDeleteConfirm ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-red-600">Delete this task?</span>
                      <button
                        onClick={handleDelete}
                        className="text-xs text-red-600 font-semibold hover:text-red-700 transition-colors"
                      >
                        Yes, delete
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="text-xs text-theme-text-tertiary hover:text-theme-text-secondary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-1.5 text-[13px] text-theme-text-tertiary hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                      <button
                        onClick={handleToggleShoppingList}
                        disabled={isShoppingBusy}
                        className={cn(
                          "flex items-center gap-1.5 text-[13px] transition-colors disabled:opacity-50",
                          shoppingItemId
                            ? "text-theme-primary hover:text-red-500"
                            : "text-theme-text-tertiary hover:text-theme-primary"
                        )}
                      >
                        <ShoppingCart size={14} />
                        {isShoppingBusy
                          ? (shoppingItemId ? "Removing..." : "Adding...")
                          : (shoppingItemId ? "On shopping list" : "Shopping list")}
                      </button>
                    </>
                  )
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="h-9 px-4 text-[13px] rounded-lg border border-theme-neutral-300 text-theme-text-secondary hover:bg-theme-brand-tint-subtle transition-colors"
                  onClick={resetState}
                >
                  Cancel
                </button>
                <button
                  className="h-9 px-4 text-[13px] rounded-lg bg-theme-primary text-white font-medium hover:bg-theme-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  disabled={!formContent.trim() || isSubmitting}
                  onClick={handleSubmit}
                >
                  {editTaskId
                    ? (isSubmitting ? "Saving..." : "Save")
                    : (isSubmitting ? "Creating..." : "Create")}
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-white/20 text-2xs font-normal">
                    {"⌘↵"}
                  </kbd>
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    );
  }
);

TaskEditorModal.displayName = "TaskEditorModal";

export default TaskEditorModal;
