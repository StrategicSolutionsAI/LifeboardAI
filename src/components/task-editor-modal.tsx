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
import { useTasksContext } from "@/contexts/tasks-context";
import type { RepeatOption, Task } from "@/hooks/use-tasks";
import {
  deriveRepeatOption,
  extractHourLabel,
  sanitizeBucketName,
  UNASSIGNED_BUCKET_LABEL,
} from "@/lib/task-form-utils";

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
}

const toHourSlot = (label: string): string | null => {
  if (!label) return null;
  return label.startsWith("hour-") ? label : `hour-${label}`;
};

const resolveTodayKey = () => format(new Date(), "yyyy-MM-dd");

const TaskEditorModal = forwardRef<TaskEditorModalHandle, TaskEditorModalProps>(
  ({ availableBuckets = [], selectedBucket, getDefaultDate, onSubmitSuccess }, ref) => {
    const { allTasks, createTask, batchUpdateTasks, refetch } = useTasksContext();

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
    }, [evaluateBucketDefault]);

    const ensureTaskLookup = useCallback((taskId?: string | null): Task | undefined => {
      if (!taskId) return undefined;
      const lookup = taskId.toString();
      return allTasks.find((task) => task.id?.toString?.() === lookup);
    }, [allTasks]);

    const openWithTask = useCallback((task: Task | undefined, dateStr: string, options: TaskEditorOpenOptions = {}) => {
      console.log('📝 Opening task editor:', { 
        taskId: task?.id, 
        taskStartDate: task?.startDate, 
        taskEndDate: task?.endDate,
        dateStr,
        taskAllDay: task?.allDay,
        taskHourSlot: task?.hourSlot
      });
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

          console.log('💾 Updating task:', {
            taskId: editTaskId,
            formTime,
            formEndTime,
            isAllDayEvent,
            hourSlot: updates.hourSlot,
            endHourSlot: updates.endHourSlot,
            startDate: resolvedStartDate,
            endDate: resolvedEndDate,
            updates
          });

          await batchUpdateTasks([{
            taskId: editTaskId,
            updates,
            occurrenceDate: resolvedStartDate,
          }]);
          
          console.log('✅ Task update completed');

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
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={resetState}
      >
        <div
          className="bg-white rounded-lg w-[520px] max-w-[92%] p-6 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{editTaskId ? "Edit Task" : "Add Task"}</h3>
              <p className="text-xs text-gray-500 mt-1">{modalDateLabel}</p>
            </div>
            <button className="text-gray-400 hover:text-gray-600" onClick={resetState}>&times;</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Task</label>
              <input
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="What do you want to do?"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Starts</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={startDate ?? ""}
                  onChange={(e) => setStartDate(e.target.value || null)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Start time</label>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  disabled={formAllDay}
                >
                  <option value="">No time</option>
                  {START_TIMES.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Ends</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={formEndDate ?? startDate ?? ""}
                  min={startDate ?? undefined}
                  onChange={(e) => setFormEndDate(e.target.value || null)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">End time</label>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  disabled={formAllDay}
                >
                  <option value="">No time</option>
                  {END_TIMES.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="inline-flex items-center text-xs text-gray-600 select-none">
                <input
                  type="checkbox"
                  className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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

            <div className={`grid gap-3 ${availableBuckets.length > 0 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
              {availableBuckets.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Category</label>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                    value={formBucket}
                    onChange={(e) => setFormBucket(e.target.value)}
                  >
                    <option value="">{UNASSIGNED_BUCKET_LABEL}</option>
                    {availableBuckets.map((bucket) => (
                      <option key={bucket} value={bucket}>{bucket}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Repeat</label>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
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

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={resetState}
              >
                Close
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={!formContent.trim() || isSubmitting}
                onClick={handleSubmit}
              >
                {editTaskId ? (isSubmitting ? "Saving…" : "Save changes") : (isSubmitting ? "Creating…" : "Create task")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

TaskEditorModal.displayName = "TaskEditorModal";

export default TaskEditorModal;
