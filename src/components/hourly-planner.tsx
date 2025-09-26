"use client";

// Enhanced hourly planner component with improved UX
// Features: better visual hierarchy, time ranges, quick actions, and intuitive interactions

import React, { useMemo, useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { format } from "date-fns";
import { useTasksContext } from "@/contexts/tasks-context";
import { X } from "lucide-react";
import {
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import type { RepeatOption } from "@/hooks/use-tasks";

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
}

// -----------------------------------------------------------------------------
// Constants – 7 AM → 9 PM with 15-minute intervals
// -----------------------------------------------------------------------------
const HOUR_HEIGHT = 64; // px that represents one hour
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
      batchUpdateTasks([{ taskId: draggableId, updates: { hourSlot: dstHour } }]).catch(() => {});
    }
  }, [batchUpdateTasks]);

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
    const timeSlot = addModalSlot;
    console.log('🚀 handleCreateTaskAtTime called:', { timeSlot, content: newTaskContent.trim(), isCreatingTask });

    if (!timeSlot || !newTaskContent.trim() || isCreatingTask) {
      console.log('❌ Early return:', { hasTimeSlot: !!timeSlot, hasContent: !!newTaskContent.trim(), isCreatingTask });
      return;
    }

    setIsCreatingTask(true);
    console.log('✅ Starting task creation process');

    try {
      const dateStr = activePlannerDate;

      console.log('📅 Creating task with params:', {
        content: newTaskContent.trim(),
        date: dateStr,
        timeSlot,
        bucket: taskBucket,
        duration: newTaskDuration,
      });

      const newTask = await createTask(newTaskContent.trim(), dateStr, undefined, taskBucket);
      console.log('📝 CreateTask response:', newTask);

      if (newTask) {
        console.log('🎯 Updating task with hourSlot:', `hour-${timeSlot}`);
        await batchUpdateTasks([
          {
            taskId: newTask.id,
            updates: {
              hourSlot: `hour-${timeSlot}`,
              duration: newTaskDuration,
            },
          },
        ]);
        console.log('✅ Task updated successfully');
      }

      setNewTaskContent("");
      setNewTaskDuration(60);
      setAddModalSlot(null);
      console.log('🔄 Reset form state');
    } catch (error) {
      console.error('💥 Failed to create task:', error);
      // Don't reset state on error so user can retry
    } finally {
      setIsCreatingTask(false);
      console.log('🏁 Task creation process finished');
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
    console.log('🎛️ Starting resize:', { hour, taskId });
    e.stopPropagation();
    e.preventDefault();

    const task = hourlyPlan[hour].find((t) => t.id === taskId);
    if (!task) {
      console.log('❌ Task not found for resize:', { hour, taskId, availableTasks: hourlyPlan[hour] });
      return;
    }
    console.log('✅ Task found, starting resize:', { taskId, task });
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
      // Only update if duration actually changed
      if (currentDuration !== startDuration) {
        // Persist duration and re-assert current hourSlot to avoid accidental moves
        batchUpdateTasks([{ taskId, updates: { duration: currentDuration, hourSlot: `hour-${hour}` } }]);
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

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizeStartRef.current) return;
      
      const delta = ev.clientY - resizeStartRef.current.y;
      const newDuration = Math.max(
        MIN_DURATION,
        Math.round((resizeStartRef.current.duration + (delta / HOUR_HEIGHT) * 60) / RESIZE_INCREMENT) * RESIZE_INCREMENT
      );
      
      currentDuration = newDuration;
      setResizingTask(prev => prev ? { ...prev, currentDuration: newDuration } : null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", endResize);
    window.addEventListener("pointerup", endResize);
    window.addEventListener("blur", endResize);
    window.addEventListener("mouseleave", endResize);
  }, [hourlyPlan, batchUpdateTasks]);

  // Remove task from hourly planner
  const removeTaskFromPlanner = async (taskId: string) => {
    try {
      // Use null (not undefined) so server clears metadata
      await batchUpdateTasks([{ taskId, updates: { hourSlot: null as any } }]);
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

  // Auto-scroll to current time slot on mount
  useEffect(() => {
    if (!containerRef.current) return;
    
    const currentHour = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
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
  }, [currentTime]);

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
            <h3 className="text-lg font-semibold text-gray-900">Schedule task</h3>
            <p className="text-sm text-gray-500 mt-1">
              {activePlannerDate} · {addModalSlot}
            </p>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600"
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
          <label className="block text-xs text-gray-600 font-medium">
            <span className="block mb-1 uppercase tracking-wide">Start time</span>
            <select
              value={newTaskStart || addModalSlot || ''}
              onChange={(e) => setNewTaskStart(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            {availableBuckets.length > 0 && (
              <label className="flex-1 text-xs text-gray-600 font-medium">
                <span className="block mb-1 uppercase tracking-wide">Bucket</span>
                <select
                  value={taskBucket}
                  onChange={(e) => setTaskBucket(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  {availableBuckets.map((bucket) => (
                    <option key={bucket} value={bucket}>{bucket}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="w-full sm:w-40 text-xs text-gray-600 font-medium">
              <span className="block mb-1 uppercase tracking-wide">Duration</span>
              <select
                value={newTaskDuration}
                onChange={(e) => setNewTaskDuration(parseInt(e.target.value, 10))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              >
                {[15, 30, 45, 60, 90, 120].map((minutes) => (
                  <option key={minutes} value={minutes}>{minutes} min</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs text-gray-600 font-medium">
            <span className="block mb-1 uppercase tracking-wide">Repeat</span>
            <select
              value={newTaskRepeat}
              onChange={(e) => setNewTaskRepeat(e.target.value as RepeatOption)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {REPEAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-gray-600 font-medium">
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
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              onClick={handleCancelCreation}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTaskContent.trim() || isCreatingTask}
              className="px-4 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
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
      className={`space-y-0 ${className} max-h-[600px] overflow-y-auto`}
    >
        {TIME_SLOTS.map((timeSlot, index) => {
          // Check if this is a major hour (on the hour)
          const isMainHour = timeSlot.indexOf(':') === -1;
          const hasTask = hourlyPlan[timeSlot].length > 0;
          const isCurrentSlot = currentSlot === timeSlot;
          
          return (
          <Droppable key={timeSlot} droppableId={`hour-${timeSlot}`}>
            {(provided, snapshot) => (
              <div
                className={`relative flex items-start gap-4 border-gray-200 transition-colors h-[17px] group ${
                  isMainHour 
                    ? 'border-t' 
                    : hasTask ? 'group-hover:border-t group-hover:border-dashed group-hover:border-gray-300' : ''
                } ${index === 0 ? 'border-t-0' : ''} ${
                  snapshot.isDraggingOver ? 'bg-indigo-50 border-indigo-200' : isCurrentSlot ? 'bg-indigo-50/70 border-indigo-100' : ''
                }`}
              >
                {/* Enhanced time label with better typography - only show for main hours */}
                <div className="w-16 shrink-0 flex flex-col items-end text-right pt-1">
                  {isMainHour ? (
                    <>
                      <span className={`text-sm font-medium leading-none ${timeSlot === currentHourDisplay ? 'text-indigo-600' : 'text-gray-900'}`}>
                        {timeSlot}
                      </span>
                      {timeSlot === currentHourDisplay ? (
                        <span className="mt-0.5 inline-flex items-center rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                          Now
                        </span>
                      ) : (
                        <div className="h-3" />
                      )}
                    </>
                  ) : (
                    <>
                      <div className="h-3" />
                      <div className="h-3" />
                    </>
                  )}
                </div>
                
                <ul
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex-1 relative overflow-visible min-h-[15px]"
                >
                  {hourlyPlan[timeSlot].map((t, index) => {
                    const taskCount = hourlyPlan[timeSlot].length;
                    // Better spacing calculation for multiple tasks
                    const taskWidth = taskCount > 1 ? `${Math.floor(100 / taskCount) - 2}%` : '100%';
                    const leftOffset = taskCount > 1 ? `${(index * Math.floor(100 / taskCount)) + 1}%` : '0%';
                    
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
                            // Let DnD control transform entirely during drag
                            ...(prov.draggableProps.style || {}),
                            height: `${Math.max(32, (taskDuration / 60) * HOUR_HEIGHT)}px`,
                            // Simplified positioning for better drag compatibility
                            position: isDraggingNow ? 'relative' : 'absolute',
                            top: isDraggingNow ? 'auto' : (taskCount > 1 ? `${Math.floor(index / Math.ceil(taskCount / 2)) * 2}px` : '0px'),
                            left: isDraggingNow ? 'auto' : leftOffset,
                            width: isDraggingNow ? 'auto' : taskWidth,
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
                            // Reset after 3 seconds to avoid permanent z-index changes
                            setTimeout(() => setFrontTaskId(prev => prev === taskId ? null : prev), 3000);
                          }}
                          aria-label={`${t.content}. ${timeSlot} to ${endTime}`}
                          className={`group relative flex items-start gap-3 px-4 py-3 
                            bg-white border border-gray-200 
                            shadow-sm hover:shadow-md 
                            rounded-xl transition-all duration-200 
                            cursor-grab active:cursor-grabbing
                            hover:border-indigo-400 hover:bg-gray-50
                            ${isDraggingNow ? 'shadow-lg rotate-1 scale-105 border-indigo-500 cursor-grabbing' : ''}
                            ${resizingTask?.taskId === t.id ? 'ring-2 ring-indigo-200' : ''}
                          `}
                          {...prov.dragHandleProps}
                        >
                          <div className="flex items-start gap-3 w-full h-full min-h-[32px]">
                            {/* Enhanced status indicator with brand colors */}
                            <div className="flex-shrink-0 mt-1">
                              <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full ring-2 ring-indigo-200" />
                            </div>
                            
                            <div className="flex flex-col w-full justify-center min-w-0">
                              {/* Conditional layout based on task height */}
                              {taskDuration >= 45 ? (
                                // Tall tasks: time on top, title below
                                <>
                                  <div className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 leading-tight tracking-wide">
                                    <span>{timeSlot}</span>
                                    <span className="text-[11px] font-medium text-gray-500">– {endTime}</span>
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
                                      className="font-semibold text-gray-900 text-sm leading-tight bg-white border border-indigo-300 rounded px-1 py-0.5 w-full focus:outline-none focus:border-indigo-500"
                                    />
                                  ) : (
                                    <div 
                                      className="font-semibold text-gray-900 truncate text-sm leading-tight cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 -mx-1 -my-0.5"
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
                                  <div className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 leading-tight tracking-wide flex-shrink-0">
                                    <span>{timeSlot}</span>
                                    <span className="text-[11px] font-medium text-gray-500">– {endTime}</span>
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
                                      className="font-semibold text-gray-900 text-sm leading-tight bg-white border border-indigo-300 rounded px-1 py-0.5 flex-1 focus:outline-none focus:border-indigo-500"
                                    />
                                  ) : (
                                    <div 
                                      className="font-semibold text-gray-900 truncate text-sm leading-tight flex-1 cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 -mx-1 -my-0.5"
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
                            
                            {/* Improved delete button */}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await deleteTask(t.id);
                              }}
                              className="flex-shrink-0 opacity-0 group-hover:opacity-100 
                                hover:bg-theme-error-100 hover:text-theme-error-600
                                rounded-md p-1.5 transition-all duration-200
                                focus:opacity-100 focus:ring-2 focus:ring-theme-error-200"
                              title="Delete task permanently"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          
                          {/* Enhanced resize handle with better visual feedback */}
                          {allowResize && (
                            <div className="absolute -bottom-1 left-2 right-2 flex justify-center">
                              <div
                                onMouseDown={(e) => startResize(e, timeSlot, t.id)}
                                className="h-3 w-10 cursor-ns-resize 
                                  bg-indigo-200 hover:bg-indigo-400 
                                  rounded-full transition-all duration-200
                                  opacity-60 group-hover:opacity-100 hover:scale-110
                                  flex items-center justify-center shadow-sm"
                              >
                                <div className="w-3 h-0.5 bg-indigo-600 rounded-full" />
                              </div>
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

                {/* Enhanced current-time indicator */}
                {showTimeIndicator && isCurrentSlot && (
                  <div
                    className="absolute left-0 right-0 pointer-events-none flex items-center z-10"
                    style={{ top: `calc(${(((currentTime.getMinutes() % 15) / 15) * 100).toFixed(2)}% - 1px)` }}
                  >
                    <div className="w-16 shrink-0" />
                    <div className="flex items-center flex-1">
                      <div className="w-3 h-3 bg-theme-primary rounded-full shadow-lg 
                        ring-2 ring-blue-200 animate-pulse" />
                      <div className="flex-1 h-0.5 bg-theme-primary shadow-sm" />
                      <div className="px-2 py-1 bg-theme-primary text-white 
                        text-xs font-medium rounded-md shadow-sm ml-2">
                        {currentTime.toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Droppable>
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
