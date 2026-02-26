"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { format, parseISO } from "date-fns";
import { X, Trash2 } from "lucide-react";
import { useTasksContext } from "@/contexts/tasks-context";
import type { RepeatOption, Task } from "@/hooks/use-tasks";
import {
  deriveRepeatOption,
  extractHourLabel,
  sanitizeBucketName,
  UNASSIGNED_BUCKET_LABEL,
} from "@/lib/task-form-utils";
import { cn } from "@/lib/utils";

const START_TIMES = ["7AM","8AM","9AM","10AM","11AM","12PM","1PM","2PM","3PM","4PM","5PM","6PM","7PM","8PM","9PM"];
const END_TIMES = ["8AM","9AM","10AM","11AM","12PM","1PM","2PM","3PM","4PM","5PM","6PM","7PM","8PM","9PM","10PM"];

type TaskEditorOpenOptions = {
  fallbackTitle?: string;
  fallbackHourLabel?: string;
  fallbackTaskId?: string;
  fallbackRepeat?: RepeatOption | null;
  fallbackBucket?: string;
  fallbackEndDate?: string;
  fallbackEndHourLabel?: string;
  fallbackAllDay?: boolean;
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

interface TaskEditorModalProps {
  availableBuckets?: string[];
  selectedBucket?: string | null;
  getDefaultDate?: () => string;
  onSubmitSuccess?: (result: { action: "create" | "update"; taskId?: string | null; date: string }) => void;
  bucketColors?: Record<string, string>;
}

const toHourSlot = (label: string): string | null => {
  if (!label) return null;
  return label.startsWith("hour-") ? label : `hour-${label}`;
};

const resolveTodayKey = () => format(new Date(), "yyyy-MM-dd");

const TaskEditorModal = forwardRef<TaskEditorModalHandle, TaskEditorModalProps>(
  ({ availableBuckets = [], selectedBucket, getDefaultDate, onSubmitSuccess, bucketColors = {} }, ref) => {
    const { allTasks, createTask, batchUpdateTasks, deleteTask, refetch } = useTasksContext();

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
        const match = label.match(/^(\d{1,2})(AM|PM)$/);
        if (!match) return undefined;
        let hours = parseInt(match[1], 10);
        const period = match[2];
        if (period === "PM" && hours !== 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        return hours;
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
            className="w-full max-w-[520px] max-h-[90vh] bg-white rounded-2xl shadow-[0px_16px_48px_rgba(0,0,0,0.12)] animate-in fade-in zoom-in-95 duration-200 ease-out flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(219,214,207,0.5)] shrink-0">
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold text-[#314158]">
                {editTaskId ? "Edit Task" : "New Task"}
              </h3>
              <p className="text-[12px] text-[#8e99a8] mt-0.5 truncate">{modalDateLabel}</p>
            </div>
            <button
              onClick={resetState}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8e99a8] hover:bg-[rgba(177,145,106,0.08)] hover:text-[#596881] transition-colors shrink-0 ml-4"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Task Name */}
            <div>
              <label className="block text-[11px] tracking-[0.6px] uppercase text-[#8e99a8] font-medium mb-2">
                Task
              </label>
              <input
                autoFocus
                className="w-full border border-[#dbd6cf] rounded-lg px-3 py-2.5 text-[14px] text-[#314158] placeholder:text-[#b5b0a8] focus:outline-none focus:ring-2 focus:ring-[rgba(177,145,106,0.3)] focus:border-[#B1916A] transition-colors"
                placeholder="What needs to be done?"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
              />
            </div>

            {/* Schedule Section */}
            <div>
              <label className="block text-[11px] tracking-[0.6px] uppercase text-[#8e99a8] font-medium mb-2">
                Schedule
              </label>
              <div className="rounded-xl border border-[#dbd6cf] overflow-hidden">
                {/* Start row */}
                <div className="grid grid-cols-2">
                  <div className="p-3">
                    <span className="text-[11px] text-[#8e99a8] mb-1.5 block">Starts</span>
                    <input
                      type="date"
                      className="w-full text-[13px] text-[#314158] bg-transparent focus:outline-none"
                      value={startDate ?? ""}
                      onChange={(e) => setStartDate(e.target.value || null)}
                    />
                  </div>
                  <div className="p-3 border-l border-[rgba(219,214,207,0.5)]">
                    <span className="text-[11px] text-[#8e99a8] mb-1.5 block">Time</span>
                    <select
                      className="w-full text-[13px] text-[#314158] bg-transparent focus:outline-none disabled:text-[#b5b0a8]"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      disabled={formAllDay}
                    >
                      <option value="">--</option>
                      {START_TIMES.map((time) => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* End row */}
                <div className="grid grid-cols-2 border-t border-[rgba(219,214,207,0.5)]">
                  <div className="p-3">
                    <span className="text-[11px] text-[#8e99a8] mb-1.5 block">Ends</span>
                    <input
                      type="date"
                      className="w-full text-[13px] text-[#314158] bg-transparent focus:outline-none"
                      value={formEndDate ?? startDate ?? ""}
                      min={startDate ?? undefined}
                      onChange={(e) => setFormEndDate(e.target.value || null)}
                    />
                  </div>
                  <div className="p-3 border-l border-[rgba(219,214,207,0.5)]">
                    <span className="text-[11px] text-[#8e99a8] mb-1.5 block">Time</span>
                    <select
                      className="w-full text-[13px] text-[#314158] bg-transparent focus:outline-none disabled:text-[#b5b0a8]"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      disabled={formAllDay}
                    >
                      <option value="">--</option>
                      {END_TIMES.map((time) => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* All day toggle */}
                <div className="px-3 py-2.5 border-t border-[rgba(219,214,207,0.5)] bg-[rgba(252,250,248,0.5)]">
                  <label className="inline-flex items-center text-[12px] text-[#596881] select-none cursor-pointer">
                    <input
                      type="checkbox"
                      className="mr-2 h-3.5 w-3.5 rounded border-[#dbd6cf] accent-[#B1916A]"
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
                <label className="block text-[11px] tracking-[0.6px] uppercase text-[#8e99a8] font-medium mb-2">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFormBucket("")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] transition-all",
                      !formBucket
                        ? "bg-[rgba(177,145,106,0.12)] border-[rgba(177,145,106,0.35)] text-[#314158] font-medium"
                        : "bg-white border-[#e2e8f0] text-[#596881] hover:border-[#cbd5e1]"
                    )}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#b5b0a8]" />
                    {UNASSIGNED_BUCKET_LABEL}
                  </button>
                  {availableBuckets.map((bucket) => {
                    const color = bucketColors[bucket] ?? "#bb9e7b";
                    const active = formBucket === bucket;
                    return (
                      <button
                        type="button"
                        key={bucket}
                        onClick={() => setFormBucket(bucket)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] transition-all",
                          active
                            ? "bg-[rgba(177,145,106,0.12)] border-[rgba(177,145,106,0.35)] text-[#314158] font-medium"
                            : "bg-white border-[#e2e8f0] text-[#596881] hover:border-[#cbd5e1]"
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

            {/* Repeat */}
            <div>
              <label className="block text-[11px] tracking-[0.6px] uppercase text-[#8e99a8] font-medium mb-2">
                Repeat
              </label>
              <select
                className="w-full border border-[#dbd6cf] rounded-lg px-3 py-2.5 text-[13px] text-[#314158] bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(177,145,106,0.3)] focus:border-[#B1916A] transition-colors"
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
          <div className="px-6 py-4 border-t border-[rgba(219,214,207,0.5)] bg-[rgba(252,250,248,0.5)] shrink-0">
            <div className="flex items-center justify-between">
              <div>
                {editTaskId && (
                  showDeleteConfirm ? (
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-red-600">Delete this task?</span>
                      <button
                        onClick={handleDelete}
                        className="text-[12px] text-red-600 font-semibold hover:text-red-700 transition-colors"
                      >
                        Yes, delete
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="text-[12px] text-[#8e99a8] hover:text-[#596881] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 text-[13px] text-[#8e99a8] hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="h-9 px-4 text-[13px] rounded-lg border border-[#dbd6cf] text-[#596881] hover:bg-[rgba(177,145,106,0.06)] transition-colors"
                  onClick={resetState}
                >
                  Cancel
                </button>
                <button
                  className="h-9 px-4 text-[13px] rounded-lg bg-[#B1916A] text-white font-medium hover:bg-[#96784f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  disabled={!formContent.trim() || isSubmitting}
                  onClick={handleSubmit}
                >
                  {editTaskId
                    ? (isSubmitting ? "Saving..." : "Save")
                    : (isSubmitting ? "Creating..." : "Create")}
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-normal">
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
