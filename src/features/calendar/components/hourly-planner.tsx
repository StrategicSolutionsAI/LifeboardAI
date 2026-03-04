"use client";

// Enhanced hourly planner component with improved UX
// Features: better visual hierarchy, time ranges, quick actions, and intuitive interactions

import React, { useMemo, useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { format } from "date-fns";
import { useTasksContext } from "@/contexts/tasks-context";
import { X, Plus } from "lucide-react";
import {
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import type { RepeatOption } from "@/types/tasks";
import { getBucketColorSync } from "@/lib/bucket-colors";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface PlannerItem {
  /** Unique identifier */
  id: string;
  /** Display title */
  content: string;
  /** Duration in minutes (15-min increments, min 15) */
  duration?: number;
  /** Bucket name for color-coding */
  bucket?: string;
}

// -----------------------------------------------------------------------------
// Constants – 7 AM → 9 PM with 15-minute intervals
// -----------------------------------------------------------------------------
const HOUR_HEIGHT = 64; // px that represents one hour
const SLOT_HEIGHT = Math.max(HOUR_HEIGHT / 4, 18); // ensures 15-minute targets stay reachable
const TIME_SLOTS = Array.from({ length: 15 * 4 }, (_, i) => {
  const totalMinutes = (7 * 60) + (i * 15); // Start at 7 AM (420 minutes), increment by 15
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  const displayHour = hours % 12 || 12;
  const period = hours < 12 ? "AM" : "PM";
  const minuteString = minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : '';
  
  return `${displayHour}${minuteString}${period}`;
});

// Keep HOURS for backward compatibility and major hour markers
const HOURS = Array.from({ length: 15 }, (_, i) => {
  const h = 7 + i;
  return `${h % 12 || 12}${h < 12 ? "AM" : "PM"}`;
});

const RESIZE_INCREMENT = 15; // minutes
const MIN_DURATION = 15; // minutes


const REPEAT_OPTIONS: { value: RepeatOption; label: string }[] = [
  { value: 'none', label: 'Do not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
];

// Helper function to parse time slot into minutes from midnight
const parseTimeSlot = (timeSlot: string): number => {
  const match = timeSlot.match(/^(\d{1,2})(?::(\d{2}))?([AP]M)$/);
  if (!match) return 0;
  
  const [, hourStr, minuteStr = '0', period] = match;
  let hours = parseInt(hourStr);
  const minutes = parseInt(minuteStr);
  
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
};

// Helper function to format minutes from midnight into time string
const formatTimeSlot = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  
  const displayHour = hours % 12 || 12;
  const period = hours < 12 ? "AM" : "PM";
  const minString = minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : '';
  
  return `${displayHour}${minString}${period}`;
};

// Helper function to calculate end time
const calculateEndTime = (startTimeSlot: string, durationMinutes: number): string => {
  const startMinutes = parseTimeSlot(startTimeSlot);
  const endMinutes = startMinutes + durationMinutes;
  return formatTimeSlot(endMinutes);
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
interface HourlyPlannerProps {
  className?: string;
  showTimeIndicator?: boolean;
  allowResize?: boolean;
  availableBuckets?: string[];
  selectedBucket?: string;
  isDragging?: boolean;
  wrapWithContext?: boolean;
  plannerDate?: string; // yyyy-MM-dd for creating tasks on selected day
  onTaskOpen?: (taskId: string, metadata?: { hourSlot?: string | null; plannerDate?: string | null }) => void;
  /** User-saved bucket→color map from preferences, for accurate color matching */
  bucketColors?: Record<string, string>;
}

export interface HourlyPlannerHandle {
  openAddTaskModal: (slot?: string) => void;
}

const HourlyPlanner = forwardRef<HourlyPlannerHandle, HourlyPlannerProps>(({
  className = "",
  showTimeIndicator = true,
  allowResize = true,
  availableBuckets = [],
  selectedBucket,
  isDragging = false,
  wrapWithContext = true,
  plannerDate,
  bucketColors: propBucketColors,
  onTaskOpen,
}, ref) => {
  const {
    scheduledTasks,
    batchUpdateTasks,
    deleteTask,
    createTask,
  } = useTasksContext();

  const activePlannerDate = useMemo(() => {
    if (plannerDate && plannerDate.trim().length > 0) {
      return plannerDate.trim();
    }
    return format(new Date(), 'yyyy-MM-dd');
  }, [plannerDate]);

  const shouldShowTaskForDate = useCallback((task: any, dateStr: string): boolean => {
    if (!task || task.completed) return false;
    const dueDateStr: string | undefined = task.due?.date ?? task.due_date ?? undefined;
    if (!dueDateStr) {
      return true;
    }

    if (!task.repeatRule || task.repeatRule === 'none') {
      return dueDateStr === dateStr;
    }

    const target = new Date(`${dateStr}T00:00:00`);
    const due = new Date(`${dueDateStr}T00:00:00`);
    if (target < due) return false;

    const day = target.getDay();
    const dueDay = due.getDay();
    const diffDays = Math.floor((target.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));

    switch (task.repeatRule) {
      case 'daily':
        return true;
      case 'weekdays':
        return day >= 1 && day <= 5;
      case 'weekly':
        return diffDays % 7 === 0 && day === dueDay;
      case 'monthly': {
        const dueDateNum = due.getDate();
        const targetDateNum = target.getDate();
        const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
        if (dueDateNum > daysInTargetMonth) {
          return targetDateNum === daysInTargetMonth;
        }
        return targetDateNum === dueDateNum;
      }
      default:
        return false;
    }
  }, []);

  const scopedScheduledTasks = useMemo(() => {
    return scheduledTasks.filter((task) => shouldShowTaskForDate(task, activePlannerDate));
  }, [scheduledTasks, shouldShowTaskForDate, activePlannerDate]);
  
  // Local drag state so the component can work standalone
  const [dragging, setDragging] = useState(false);
  const effectiveDragging = isDragging || dragging;
  const suppressDragUntilRef = useRef<number>(0);
  const [draggingOverSlot, setDraggingOverSlot] = useState<string | null>(null);

  const handleDragEnd = useCallback((result: DropResult) => {
    setDragging(false);
    // If a resize gesture is in progress or just ended, ignore drag end
    try {
      if (typeof document !== 'undefined' && document.body.classList.contains('lb-resizing')) {
        return;
      }
    } catch {}
    if (Date.now() < suppressDragUntilRef.current) return;
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    const isHour = (id: string) => id.startsWith('hour-');
    if (isHour(source.droppableId) && isHour(destination.droppableId)) {
      const dstHour = destination.droppableId; // keep full hour-<slot>
      batchUpdateTasks([{ taskId: draggableId, updates: { hourSlot: dstHour }, occurrenceDate: activePlannerDate }]).catch(() => {});
    }
  }, [batchUpdateTasks, activePlannerDate]);

  // Ref for the scrollable container
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State for inline task creation
  const [newTaskContent, setNewTaskContent] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskBucket, setTaskBucket] = useState(selectedBucket || (availableBuckets.length > 0 ? availableBuckets[0] : ''));
  const [newTaskDuration, setNewTaskDuration] = useState<number>(60);
  const [newTaskStart, setNewTaskStart] = useState<string>('');
  const [newTaskRepeat, setNewTaskRepeat] = useState<RepeatOption>('none');
  const [addModalSlot, setAddModalSlot] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBucket) {
      setTaskBucket(selectedBucket);
    } else if (!taskBucket && availableBuckets.length > 0) {
      setTaskBucket(availableBuckets[0]);
    }
  }, [selectedBucket, availableBuckets, taskBucket]);
  
  // Track which task should be brought to front when overlapping
  const [frontTaskId, setFrontTaskId] = useState<string | null>(null);
  
  // Track task editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  
  // Handle starting task edit
  const handleStartEdit = (task: PlannerItem) => {
    setEditingTaskId(task.id.toString());
    setEditingContent(task.content);
  };
  
  // Handle saving task edit
  const handleSaveEdit = async () => {
    if (!editingTaskId || !editingContent.trim()) return;
    
    try {
      await batchUpdateTasks([{ 
        taskId: editingTaskId, 
        updates: { content: editingContent.trim() } 
      }]);
      setEditingTaskId(null);
      setEditingContent('');
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };
  
  // Handle canceling task edit
  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingContent('');
  };
  
  // Handle creating a new task at a specific time slot
  const handleCreateTaskAtTime = async () => {
    const resolvedContent = newTaskContent.trim();
    const chosenSlot = newTaskStart || addModalSlot || TIME_SLOTS[0];

    if (!chosenSlot || !resolvedContent || isCreatingTask) {
      return;
    }

    setIsCreatingTask(true);

    try {
      const ensureHourPrefix = (slot: string) =>
        slot.startsWith('hour-') ? slot : `hour-${slot}`;
      const stripHourPrefix = (slot: string) =>
        slot.startsWith('hour-') ? slot.replace('hour-', '') : slot;

      const dateStr = activePlannerDate;
      const startLabel = stripHourPrefix(chosenSlot);
      const normalizedStartSlot = ensureHourPrefix(chosenSlot);
      const endLabel = calculateEndTime(startLabel, newTaskDuration);
      const normalizedEndSlot = endLabel ? ensureHourPrefix(endLabel) : undefined;
      const repeatRule = newTaskRepeat ?? 'none';

      const newTask = await createTask(
        resolvedContent,
        dateStr,
        normalizedStartSlot,
        taskBucket,
        repeatRule,
        {
          endDate: dateStr,
          endHourSlot: normalizedEndSlot,
          allDay: false,
        }
      );

      if (newTask) {
        await batchUpdateTasks([
          {
            taskId: newTask.id,
            updates: {
              hourSlot: normalizedStartSlot,
              endHourSlot: normalizedEndSlot ?? null,
              duration: newTaskDuration,
              allDay: false,
            },
            occurrenceDate: dateStr,
          },
        ]);
      }

      setNewTaskContent('');
      setNewTaskDuration(60);
      setNewTaskRepeat('none');
      setNewTaskStart('');
      setAddModalSlot(null);
    } catch (error) {
      console.error('Failed to create task:', error);
      // Don't reset state on error so user can retry
    } finally {
      setIsCreatingTask(false);
    }
  };


  const openAddModal = useCallback((timeSlot: string) => {
    if (!effectiveDragging) {
      setAddModalSlot(timeSlot);
      setNewTaskContent("");
      setNewTaskDuration(60);
      setNewTaskRepeat('none');
      setNewTaskStart(timeSlot);
      if (selectedBucket) setTaskBucket(selectedBucket);
      else if (availableBuckets.length > 0) setTaskBucket(availableBuckets[0]);
    }
  }, [availableBuckets, selectedBucket, effectiveDragging]);

  // Handle canceling task creation
  const handleCancelCreation = () => {
    setNewTaskContent("");
    setIsCreatingTask(false);
    setNewTaskDuration(60);
    setNewTaskRepeat('none');
    setNewTaskStart('');
    setAddModalSlot(null);
  };
  
  // Build hourly plan from scheduled tasks plus pending tasks
  const hourlyPlan = useMemo(() => {
    const plan: Record<string, PlannerItem[]> = {};
    TIME_SLOTS.forEach((slot) => (plan[slot] = []));
    
    // Process only tasks that have been scheduled (have hourSlot)
    scopedScheduledTasks.forEach((t) => {
      const slot = t.hourSlot?.replace('hour-', '') || '';
      
      // Validate slot exists in our time slots array
      if (!TIME_SLOTS.includes(slot)) {
        return;
      }
      
      plan[slot].push({
        id: t.id.toString(),
        content: t.content,
        duration: t.duration ?? 60,
        bucket: t.bucket,
      });
    });
    
    return plan;
  }, [scopedScheduledTasks]);

  // Resize state and handlers
  const [resizingTask, setResizingTask] = useState<{
    taskId: string;
    hour: string;
    currentDuration: number;
  } | null>(null);
  const resizeStartRef = useRef<{
    y: number;
    duration: number;
    taskId: string;
    hour: string;
  } | null>(null);

  const startResize = useCallback((e: React.MouseEvent, hour: string, taskId: string) => {
    e.stopPropagation();
    e.preventDefault();

    const task = hourlyPlan[hour].find((t) => t.id === taskId);
    if (!task) {
      return;
    }
    const startDuration = task?.duration ?? 60;
    let currentDuration = startDuration;
    
    resizeStartRef.current = { 
      y: e.clientY, 
      duration: startDuration, 
      taskId, 
      hour 
    };
    setResizingTask({ taskId, hour, currentDuration: startDuration });
    // Mark global resizing flag to prevent DnD handlers from acting
    try { document.body.classList.add('lb-resizing'); } catch {}
    suppressDragUntilRef.current = Date.now() + 300;

    // Guard against multiple finalizations
    let ended = false;
    const endResize = () => {
      if (ended) return;
      ended = true;
      // Cancel any pending RAF
      if (rafId) cancelAnimationFrame(rafId);
      // Only update if duration actually changed
      if (currentDuration !== startDuration) {
        // Persist duration and re-assert current hourSlot to avoid accidental moves
        batchUpdateTasks([{ taskId, updates: { duration: currentDuration, hourSlot: `hour-${hour}` }, occurrenceDate: activePlannerDate }]);
      }
      setResizingTask(null);
      resizeStartRef.current = null;
      try { document.body.classList.remove('lb-resizing'); } catch {}
      suppressDragUntilRef.current = Date.now() + 250;
      // Remove listeners
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", endResize);
      window.removeEventListener("pointerup", endResize);
      window.removeEventListener("blur", endResize);
      window.removeEventListener("mouseleave", endResize);
    };

    let rafId = 0;
    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizeStartRef.current) return;

      const delta = ev.clientY - resizeStartRef.current.y;
      const newDuration = Math.max(
        MIN_DURATION,
        Math.round((resizeStartRef.current.duration + (delta / HOUR_HEIGHT) * 60) / RESIZE_INCREMENT) * RESIZE_INCREMENT
      );

      currentDuration = newDuration;
      // Throttle state updates to once per animation frame
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        setResizingTask(prev => prev ? { ...prev, currentDuration: newDuration } : null);
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", endResize);
    window.addEventListener("pointerup", endResize);
    window.addEventListener("blur", endResize);
    window.addEventListener("mouseleave", endResize);
  }, [hourlyPlan, batchUpdateTasks, activePlannerDate]);

  useEffect(() => {
    if (!effectiveDragging) {
      setDraggingOverSlot(null);
    }
  }, [effectiveDragging]);

  const handleSlotHover = useCallback((slot: string, isActive: boolean) => {
    if (!effectiveDragging) return;
    setDraggingOverSlot(prev => {
      if (isActive) return slot;
      return prev === slot ? null : prev;
    });
  }, [effectiveDragging]);

  // Remove task from hourly planner
  const removeTaskFromPlanner = async (taskId: string) => {
    try {
      // Use null (not undefined) so server clears metadata
      await batchUpdateTasks([{ taskId, updates: { hourSlot: null as any }, occurrenceDate: activePlannerDate }]);
    } catch (error) {
      // Error handling is done in the context
    }
  };

  // Current time indicator ----------------------------------------------------
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentSlot = useMemo(() => {
    const totalMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    for (let i = 0; i < TIME_SLOTS.length; i++) {
      const slotStart = parseTimeSlot(TIME_SLOTS[i]);
      const slotEnd = slotStart + 15;
      if (totalMinutes >= slotStart && totalMinutes < slotEnd) {
        return TIME_SLOTS[i];
      }
    }
    return "";
  }, [currentTime]);

  const currentHourDisplay = useMemo(() => {
    if (!currentSlot) return "";
    const slotMinutes = parseTimeSlot(currentSlot);
    const hourStart = Math.floor(slotMinutes / 60) * 60;
    return formatTimeSlot(hourStart);
  }, [currentSlot]);

  useImperativeHandle(ref, () => ({
    openAddTaskModal: (slot?: string) => {
      const normalized = (() => {
        if (slot) {
          const cleaned = slot.startsWith('hour-') ? slot.replace('hour-', '') : slot;
          if (TIME_SLOTS.includes(cleaned)) {
            return cleaned;
          }
        }
        if (currentSlot && TIME_SLOTS.includes(currentSlot)) {
          return currentSlot;
        }
        return TIME_SLOTS[0];
      })();
      openAddModal(normalized);
    },
  }), [openAddModal, currentSlot]);

  // Auto-scroll to current time slot ONCE on mount only
  const hasAutoScrolled = useRef(false);
  useEffect(() => {
    if (!containerRef.current || hasAutoScrolled.current) return;
    hasAutoScrolled.current = true;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    let targetSlotIndex = -1;

    // Find current time slot in our TIME_SLOTS array
    for (let i = 0; i < TIME_SLOTS.length; i++) {
      const slotMinutes = parseTimeSlot(TIME_SLOTS[i]);
      const totalCurrentMinutes = currentHour * 60 + currentMinutes;

      if (slotMinutes <= totalCurrentMinutes && (i === TIME_SLOTS.length - 1 || parseTimeSlot(TIME_SLOTS[i + 1]) > totalCurrentMinutes)) {
        targetSlotIndex = Math.max(0, i - 4); // Show a few slots above current time
        break;
      }
    }

    // Handle edge cases
    if (targetSlotIndex === -1) {
      const totalCurrentMinutes = currentHour * 60 + currentMinutes;
      const startMinutes = 7 * 60; // 7 AM
      const endMinutes = 21 * 60; // 9 PM

      if (totalCurrentMinutes < startMinutes) {
        targetSlotIndex = 0;
      } else if (totalCurrentMinutes > endMinutes) {
        targetSlotIndex = TIME_SLOTS.length - 1;
      }
    }

    if (targetSlotIndex >= 0) {
      const scrollPosition = Math.floor(targetSlotIndex / 4) * 68; // Each hour (4 slots) = 68px
      containerRef.current.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  const addTaskModal = addModalSlot ? (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3" onClick={handleCancelCreation}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-theme-text-primary">Schedule task</h3>
            <p className="text-sm text-theme-text-tertiary mt-1">
              {activePlannerDate} · {addModalSlot}
            </p>
          </div>
          <button
            className="text-theme-text-tertiary/70 hover:text-theme-text-subtle"
            onClick={handleCancelCreation}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateTaskAtTime();
          }}
          className="space-y-3"
        >
          <label className="block text-xs text-theme-text-subtle font-medium">
            <span className="block mb-1 uppercase tracking-wide">Start time</span>
            <select
              value={newTaskStart || addModalSlot || ''}
              onChange={(e) => setNewTaskStart(e.target.value)}
              className="w-full rounded border border-theme-neutral-300 px-2 py-1.5 text-sm focus:border-theme-secondary focus:outline-none"
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            {availableBuckets.length > 0 && (
              <label className="flex-1 text-xs text-theme-text-subtle font-medium">
                <span className="block mb-1 uppercase tracking-wide">Bucket</span>
                <select
                  value={taskBucket}
                  onChange={(e) => setTaskBucket(e.target.value)}
                  className="w-full rounded border border-theme-neutral-300 px-2 py-1.5 text-sm focus:border-theme-secondary focus:outline-none"
                >
                  {availableBuckets.map((bucket) => (
                    <option key={bucket} value={bucket}>{bucket}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="w-full sm:w-40 text-xs text-theme-text-subtle font-medium">
              <span className="block mb-1 uppercase tracking-wide">Duration</span>
              <select
                value={newTaskDuration}
                onChange={(e) => setNewTaskDuration(parseInt(e.target.value, 10))}
                className="w-full rounded border border-theme-neutral-300 px-2 py-1.5 text-sm focus:border-theme-secondary focus:outline-none"
              >
                {[15, 30, 45, 60, 90, 120].map((minutes) => (
                  <option key={minutes} value={minutes}>{minutes} min</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs text-theme-text-subtle font-medium">
            <span className="block mb-1 uppercase tracking-wide">Repeat</span>
            <select
              value={newTaskRepeat}
              onChange={(e) => setNewTaskRepeat(e.target.value as RepeatOption)}
              className="w-full rounded border border-theme-neutral-300 px-2 py-1.5 text-sm focus:border-theme-secondary focus:outline-none"
            >
              {REPEAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-theme-text-subtle font-medium">
            <span className="block mb-1 uppercase tracking-wide">Task</span>
            <input
              type="text"
              value={newTaskContent}
              onChange={(e) => setNewTaskContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancelCreation();
                }
              }}
              autoFocus
              placeholder="What needs to be done?"
              className="w-full rounded border border-theme-neutral-300 px-3 py-2 text-sm focus:border-theme-secondary focus:outline-none"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-3 py-1.5 text-sm text-theme-text-subtle hover:text-gray-800"
              onClick={handleCancelCreation}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTaskContent.trim() || isCreatingTask}
              className="px-4 py-1.5 text-sm rounded bg-theme-secondary text-white hover:bg-theme-primary-600 disabled:opacity-50"
            >
              {isCreatingTask ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  const content = (
    <div
      ref={containerRef}
      className={`space-y-0 ${className} max-h-[600px] overflow-y-auto scrollbar-thin`}
    >
        {TIME_SLOTS.map((timeSlot, index) => {
          // Check if this is a major hour (on the hour)
          const isMainHour = timeSlot.indexOf(':') === -1;
          const hasTask = hourlyPlan[timeSlot].length > 0;
          const isCurrentSlot = currentSlot === timeSlot;
          // Determine if this slot is in the past (before current time)
          const slotMinutes = parseTimeSlot(timeSlot);
          const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
          const isPast = showTimeIndicator && slotMinutes < nowMinutes;

          return (
          <React.Fragment key={timeSlot}>
            <Droppable droppableId={`hour-${timeSlot}`}>
              {(provided, snapshot) => (
                <div
                  className={`relative flex items-start gap-3 transition-colors group ${
                    isMainHour
                      ? 'border-t border-theme-neutral-300/30 h-[18px]'
                      : hasTask ? 'h-[17px]' : 'h-[17px]'
                  } ${index === 0 ? 'border-t-0' : ''} ${
                    snapshot.isDraggingOver
                      ? 'bg-theme-primary-50/80'
                      : isPast && !hasTask
                      ? 'opacity-40'
                      : ''
                  }`}
                  style={{ minHeight: SLOT_HEIGHT }}
                  onMouseEnter={() => handleSlotHover(timeSlot, true)}
                  onMouseLeave={() => handleSlotHover(timeSlot, false)}
                >
                  {/* Time label - only for main hours, positioned above the dividing line */}
                  <div className="w-[56px] shrink-0 flex flex-col items-end text-right pr-1">
                    {isMainHour && !(showTimeIndicator && isCurrentSlot) ? (
                      <span className={`text-[11px] font-semibold leading-none tabular-nums -translate-y-full -mt-[3px] ${
                        isPast ? 'text-theme-text-quaternary/60' : 'text-theme-text-tertiary'
                      }`}>
                        {timeSlot}
                      </span>
                    ) : (
                      <div className="h-3" />
                    )}
                  </div>

                  <ul
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex-1 relative overflow-visible min-h-[15px]"
                    style={{ minHeight: SLOT_HEIGHT }}
                  >
                    {/* Drag-over indicator */}
                    {effectiveDragging && (draggingOverSlot === timeSlot || snapshot.isDraggingOver) && (
                      <>
                        <div
                          className="pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed border-theme-primary-300/60 bg-theme-primary-50/40"
                          style={{ zIndex: 0 }}
                        />
                        <div
                          className="pointer-events-none absolute right-2 top-0.5 text-[10px] font-semibold text-theme-primary-500/70"
                          style={{ zIndex: 0 }}
                        >
                          {timeSlot}
                        </div>
                      </>
                    )}

                    {/* Hover-to-add affordance for empty main hour slots */}
                    {isMainHour && !hasTask && !effectiveDragging && (
                      <button
                        type="button"
                        onClick={() => openAddModal(timeSlot)}
                        className="absolute inset-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity z-[1] cursor-pointer pl-1"
                        aria-label={`Add task at ${timeSlot}`}
                      >
                        <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-theme-neutral-300/60 bg-theme-surface-alt/40 px-2 py-0.5 text-[10px] font-medium text-theme-text-quaternary hover:text-theme-text-secondary hover:bg-theme-brand-tint-subtle hover:border-theme-primary-300/40 transition-colors">
                          <Plus size={10} />
                          Add task
                        </span>
                      </button>
                    )}

                    {hourlyPlan[timeSlot].map((t, index) => {
                      const taskCount = hourlyPlan[timeSlot].length;
                      const taskWidth = taskCount > 1 ? `${Math.floor(100 / taskCount) - 2}%` : '100%';
                      const leftOffset = taskCount > 1 ? `${(index * Math.floor(100 / taskCount)) + 1}%` : '0%';
                      const bucketColor = t.bucket ? getBucketColorSync(t.bucket, propBucketColors) : null;

                      return (
                      <Draggable
                        key={t.id}
                        draggableId={t.id.toString()}
                        index={index}
                        isDragDisabled={Boolean(resizingTask && resizingTask.taskId === t.id)}
                      >
                        {(prov, dragSnapshot) => {
                          const isResizing = resizingTask?.taskId === t.id;
                          const taskDuration = isResizing ? resizingTask.currentDuration : t.duration ?? 60;
                          const isDraggingNow = dragSnapshot.isDragging;
                          const endTime = calculateEndTime(timeSlot, taskDuration);

                          return (
                          <li
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            style={{
                              ...(prov.draggableProps.style || {}),
                              height: `${Math.max(32, (taskDuration / 60) * HOUR_HEIGHT)}px`,
                              // When dragging, let the library control position/top/left/width
                              // (it uses position:fixed + transform to track the cursor)
                              ...(!isDraggingNow ? {
                                position: 'absolute' as const,
                                top: taskCount > 1 ? `${Math.floor(index / Math.ceil(taskCount / 2)) * 2}px` : '0px',
                                left: leftOffset,
                                width: taskWidth,
                              } : {}),
                              zIndex: isResizing ? 1000 : (isDraggingNow ? 1000 : (frontTaskId === t.id.toString() ? 999 : index + 1)),
                              ...(isResizing ? { transform: 'none', transition: 'none' } : {}),
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const taskId = t.id.toString();
                              if (onTaskOpen) {
                                const normalizedSlot = timeSlot.startsWith('hour-') ? timeSlot : `hour-${timeSlot}`;
                                onTaskOpen(taskId, {
                                  hourSlot: normalizedSlot,
                                  plannerDate: activePlannerDate,
                                });
                                return;
                              }
                              setFrontTaskId(taskId);
                              setTimeout(() => setFrontTaskId(prev => prev === taskId ? null : prev), 3000);
                            }}
                            aria-label={`${t.content}. ${timeSlot} to ${endTime}`}
                            className={`group relative flex items-start gap-2.5 py-2.5 pr-3 pl-0
                              bg-white border border-theme-neutral-300/80
                              shadow-sm hover:shadow-warm
                              rounded-xl transition-all duration-200
                              cursor-grab active:cursor-grabbing
                              hover:border-theme-primary-300 hover:bg-theme-surface-alt
                              overflow-hidden
                              ${isDraggingNow ? 'shadow-warm-lg rotate-1 scale-105 border-theme-primary-300 cursor-grabbing' : ''}
                              ${resizingTask?.taskId === t.id ? 'ring-2 ring-theme-neutral-300' : ''}
                            `}
                          >
                            {/* Bucket color accent bar */}
                            <div
                              className="w-1 self-stretch rounded-l-xl shrink-0"
                              style={{ backgroundColor: bucketColor || 'var(--theme-primary-300)' }}
                            />

                            <div
                              className="flex items-start gap-2.5 w-full h-full min-h-[28px] pl-1"
                              {...(() => {
                                const handleProps = prov.dragHandleProps ?? {};
                                const { onMouseDown, onTouchStart, ...rest } = handleProps as any;
                                return {
                                  ...rest,
                                  onMouseDown: (event: React.MouseEvent<any, MouseEvent>) => {
                                    if ((event.target as HTMLElement).closest('[data-no-drag="true"]')) {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      return;
                                    }
                                    onMouseDown?.(event);
                                  },
                                  onTouchStart: (event: React.TouchEvent<any>) => {
                                    if ((event.target as HTMLElement).closest('[data-no-drag="true"]')) {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      return;
                                    }
                                    onTouchStart?.(event);
                                  },
                                };
                              })()}
                            >
                              <div className="flex flex-col w-full justify-center min-w-0">
                                {/* Conditional layout based on task height */}
                                {taskDuration >= 45 ? (
                                  // Tall tasks: time on top, title below
                                  <>
                                    <div className="mb-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium leading-tight tracking-wide">
                                      <span className="text-theme-text-tertiary tabular-nums">{timeSlot}</span>
                                      <span className="text-theme-text-quaternary">–</span>
                                      <span className="text-theme-text-tertiary tabular-nums">{endTime}</span>
                                      {t.bucket && (
                                        <span
                                          className="ml-1 rounded px-1.5 py-px text-[10px] font-medium"
                                          style={{
                                            backgroundColor: bucketColor ? bucketColor + '18' : undefined,
                                            color: bucketColor || undefined,
                                          }}
                                        >
                                          {t.bucket}
                                        </span>
                                      )}
                                    </div>
                                    {editingTaskId === t.id.toString() ? (
                                      <input
                                        type="text"
                                        value={editingContent}
                                        onChange={(e) => setEditingContent(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveEdit();
                                          } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            handleCancelEdit();
                                          }
                                        }}
                                        onBlur={handleSaveEdit}
                                        autoFocus
                                        className="font-semibold text-theme-text-primary text-sm leading-tight bg-white border border-theme-neutral-300 rounded px-1 py-0.5 w-full focus:outline-none focus:border-theme-secondary"
                                        data-no-drag="true"
                                      />
                                    ) : (
                                      <div
                                        className="font-semibold text-theme-text-primary truncate text-sm leading-tight cursor-pointer hover:bg-theme-brand-tint-light rounded px-1 py-0.5 -mx-1 -my-0.5"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const taskId = t.id.toString();
                                          if (onTaskOpen) {
                                            const normalizedSlot = timeSlot.startsWith('hour-') ? timeSlot : `hour-${timeSlot}`;
                                            onTaskOpen(taskId, {
                                              hourSlot: normalizedSlot,
                                              plannerDate: activePlannerDate,
                                            });
                                            return;
                                          }
                                          setFrontTaskId(taskId);
                                          setTimeout(() => setFrontTaskId(prev => prev === taskId ? null : prev), 3000);
                                          handleStartEdit(t);
                                        }}
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          handleStartEdit(t);
                                        }}
                                      >
                                        {t.content}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  // Short tasks: time and title on same row
                                  <div className="flex items-center gap-2 w-full">
                                    <div className="inline-flex items-center gap-1 text-[11px] font-medium leading-tight tracking-wide flex-shrink-0 tabular-nums">
                                      <span className="text-theme-text-tertiary">{timeSlot}</span>
                                      <span className="text-theme-text-quaternary">–</span>
                                      <span className="text-theme-text-tertiary">{endTime}</span>
                                    </div>
                                    {editingTaskId === t.id.toString() ? (
                                      <input
                                        type="text"
                                        value={editingContent}
                                        onChange={(e) => setEditingContent(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveEdit();
                                          } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            handleCancelEdit();
                                          }
                                        }}
                                        onBlur={handleSaveEdit}
                                        autoFocus
                                        className="font-semibold text-theme-text-primary text-sm leading-tight bg-white border border-theme-neutral-300 rounded px-1 py-0.5 flex-1 focus:outline-none focus:border-theme-secondary"
                                        data-no-drag="true"
                                      />
                                    ) : (
                                      <div
                                        className="font-semibold text-theme-text-primary truncate text-sm leading-tight flex-1 cursor-pointer hover:bg-theme-brand-tint-light rounded px-1 py-0.5 -mx-1 -my-0.5"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const taskId = t.id.toString();
                                          if (onTaskOpen) {
                                            const normalizedSlot = timeSlot.startsWith('hour-') ? timeSlot : `hour-${timeSlot}`;
                                            onTaskOpen(taskId, {
                                              hourSlot: normalizedSlot,
                                              plannerDate: activePlannerDate,
                                            });
                                            return;
                                          }
                                          setFrontTaskId(taskId);
                                          setTimeout(() => setFrontTaskId(prev => prev === taskId ? null : prev), 3000);
                                          handleStartEdit(t);
                                        }}
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          handleStartEdit(t);
                                        }}
                                      >
                                        {t.content}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Delete button */}
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await deleteTask(t.id, activePlannerDate);
                                }}
                                className="flex-shrink-0 opacity-0 group-hover:opacity-100
                                  hover:bg-red-50 hover:text-red-500
                                  rounded-md p-1 transition-all duration-150
                                  focus:opacity-100 focus:ring-2 focus:ring-red-200"
                                title="Delete task permanently"
                                data-no-drag="true"
                              >
                                <X size={13} />
                              </button>
                            </div>

                            {/* Resize handle */}
                            {allowResize && (
                              <div className="absolute -bottom-1 left-3 right-3 flex justify-center">
                                <div
                                  onMouseDown={(e) => startResize(e, timeSlot, t.id)}
                                  className="h-2.5 w-8 cursor-ns-resize
                                    bg-theme-neutral-300/60 hover:bg-theme-primary-400
                                    rounded-full transition-all duration-150
                                    opacity-0 group-hover:opacity-100 hover:scale-110
                                    flex items-center justify-center"
                                  data-no-drag="true"
                                >
                                  <div className="w-3 h-px bg-theme-text-quaternary rounded-full" />
                                </div>
                              </div>
                            )}
                            {isResizing && (
                              <div className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 rounded-md bg-theme-primary px-2 py-0.5 text-[10px] font-semibold text-white shadow-warm-lg tabular-nums">
                                {endTime}
                              </div>
                            )}
                          </li>
                          );
                        }}
                      </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </ul>

                  {/* Current-time "now" line */}
                  {showTimeIndicator && isCurrentSlot && (
                    <div
                      className="absolute left-0 right-0 pointer-events-none flex items-center z-20"
                      style={{ top: `calc(${(((currentTime.getMinutes() % 15) / 15) * 100).toFixed(2)}% - 1px)` }}
                    >
                      <div className="w-[60px] shrink-0 flex justify-end pr-1">
                        <span className="text-[11px] font-bold text-theme-primary-600 tabular-nums leading-none">
                          {currentTime.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                      <div className="flex items-center flex-1">
                        <div className="w-3 h-3 rounded-full shadow-warm-sm bg-theme-primary-500 -ml-[5px]" />
                        <div className="flex-1 h-[2px] bg-gradient-to-r from-theme-primary-500 to-theme-primary-300/40" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </React.Fragment>
          );
        })}
    </div>
  );
  if (wrapWithContext) {
    return (
      <DragDropContext onDragStart={() => setDragging(true)} onDragEnd={handleDragEnd}>
        {content}
        {addTaskModal}
      </DragDropContext>
    );
  }

  return (
    <>
      {content}
      {addTaskModal}
    </>
  );
});

HourlyPlanner.displayName = "HourlyPlanner";

export default HourlyPlanner;
