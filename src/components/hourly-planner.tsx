"use client";

// Enhanced hourly planner component with improved UX
// Features: better visual hierarchy, time ranges, quick actions, and intuitive interactions

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useTasksContext } from "@/contexts/tasks-context";
import { X, Plus } from "lucide-react";
import {
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";

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
// Constants – 7 AM → 9 PM
// -----------------------------------------------------------------------------
const HOUR_HEIGHT = 64; // px that represents one hour
const HOURS = Array.from({ length: 15 }, (_, i) => {
  const h = 7 + i;
  return `${h % 12 || 12}${h < 12 ? "AM" : "PM"}`;
});

const RESIZE_INCREMENT = 15; // minutes
const MIN_DURATION = 15; // minutes

// Helper function to calculate end time
const calculateEndTime = (startHour: string, durationMinutes: number): string => {
  const hourIndex = HOURS.indexOf(startHour);
  if (hourIndex === -1) return startHour;
  
  const startHourNum = 7 + hourIndex;
  const endTimeMinutes = (startHourNum * 60) + durationMinutes;
  const endHour = Math.floor(endTimeMinutes / 60) % 24;
  const endMin = endTimeMinutes % 60;
  
  const displayHour = endHour % 12 || 12;
  const period = endHour < 12 ? "AM" : "PM";
  const minString = endMin > 0 ? `:${endMin.toString().padStart(2, '0')}` : "";
  
  return `${displayHour}${minString}${period}`;
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
}

export default function HourlyPlanner({ 
  className = "", 
  showTimeIndicator = true,
  allowResize = true,
  availableBuckets = [],
  selectedBucket,
  isDragging = false,
  wrapWithContext = true,
  plannerDate
}: HourlyPlannerProps) {
  const {
    scheduledTasks,
    batchUpdateTasks,
    deleteTask,
    createTask,
  } = useTasksContext();
  
  // Local drag state so the component can work standalone
  const [dragging, setDragging] = useState(false);
  const effectiveDragging = isDragging || dragging;

  const handleDragEnd = useCallback((result: DropResult) => {
    setDragging(false);
    // If a resize gesture is in progress or just ended, ignore drag end
    try {
      if (typeof document !== 'undefined' && document.body.classList.contains('lb-resizing')) {
        return;
      }
    } catch {}
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
  const [creatingTaskAt, setCreatingTaskAt] = useState<string | null>(null);
  const [newTaskContent, setNewTaskContent] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskBucket, setTaskBucket] = useState(selectedBucket || (availableBuckets.length > 0 ? availableBuckets[0] : ''));
  
  // Local state for newly created tasks to show immediately
  const [pendingTasks, setPendingTasks] = useState<PlannerItem[]>([]);
  
  // Handle creating a new task at a specific time slot
  const handleCreateTaskAtTime = async (timeSlot: string) => {
    if (!newTaskContent.trim() || isCreatingTask) return;
    
    setIsCreatingTask(true);
    
    // Create a temporary task to show immediately
    const tempTask: PlannerItem = {
      id: `temp-${timeSlot}-${Date.now()}`,
      content: newTaskContent.trim(),
      duration: 60
    };
    
    try {
      // Use provided planner date (calendar selected day) or fallback to today
      const dateStr = plannerDate || new Date().toISOString().split('T')[0];
      
      console.log('Creating task:', { content: newTaskContent.trim(), date: dateStr, timeSlot });
      
      // Add to pending tasks for immediate display
      setPendingTasks(prev => [...prev, tempTask]);
      
      // Create the task via API
      const newTask = await createTask(newTaskContent.trim(), dateStr, undefined, taskBucket);
      
      console.log('Task created:', newTask);
      
      // Update with the hourSlot immediately
      if (newTask) {
        console.log('Updating hourSlot for task:', newTask.id);
        
        await batchUpdateTasks([{ 
          taskId: newTask.id, 
          updates: { 
            hourSlot: `hour-${timeSlot}`,
            duration: 60
          } 
        }]);
        console.log('Task updated with hourSlot');
        
        // Remove the temporary task once the real one is updated
        setPendingTasks(prev => prev.filter(t => t.id !== tempTask.id));
      }
      
      // Reset state
      setNewTaskContent("");
      setCreatingTaskAt(null);
    } catch (error) {
      console.error('Failed to create task:', error);
      // Remove the pending task on error
      setPendingTasks(prev => prev.filter(t => t.id !== tempTask.id));
      // Don't reset state on error so user can retry
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Handle clicking on a time slot to start creating a task
  const handleTimeSlotClick = (timeSlot: string) => {
    // Don't interfere with existing tasks
    if (hourlyPlan[timeSlot].length > 0) return;
    
    setCreatingTaskAt(timeSlot);
    setNewTaskContent("");
  };

  // Handle canceling task creation
  const handleCancelCreation = () => {
    setCreatingTaskAt(null);
    setNewTaskContent("");
    setIsCreatingTask(false);
  };
  
  // Build hourly plan from scheduled tasks plus pending tasks
  const hourlyPlan = useMemo(() => {
    const plan: Record<string, PlannerItem[]> = {};
    HOURS.forEach((h) => (plan[h] = []));
    
    // Process only tasks that have been scheduled (have hourSlot)
    scheduledTasks.forEach((t) => {
      const slot = t.hourSlot?.replace('hour-', '') || '';
      
      // Validate slot exists in our hours array
      if (!HOURS.includes(slot)) {
        return;
      }
      
      plan[slot].push({
        id: t.id.toString(),
        content: t.content,
        duration: t.duration ?? 60,
      });
    });
    
    // Add pending tasks to show immediate feedback
    pendingTasks.forEach((task) => {
      const slot = task.id.split('-')[1]; // Extract time slot from temp ID like "temp-7AM-123456"
      if (HOURS.includes(slot) && plan[slot]) {
        plan[slot].push(task);
      }
    });
    
    return plan;
  }, [scheduledTasks, pendingTasks]);

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
      await batchUpdateTasks([{ taskId, updates: { hourSlot: undefined } }]);
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
  const currentHourDisplay = useMemo(() => {
    const h = currentTime.getHours();
    return `${h % 12 || 12}${h < 12 ? "AM" : "PM"}`;
  }, [currentTime]);

  // Auto-scroll to current hour on mount
  useEffect(() => {
    if (!containerRef.current) return;
    
    const currentHour = currentTime.getHours();
    let targetHourIndex = -1;
    
    // Find current hour in our hours array (7 AM to 9 PM)
    for (let i = 0; i < HOURS.length; i++) {
      const hourNum = 7 + i;
      if (hourNum === currentHour) {
        targetHourIndex = Math.max(0, i - 1);
        break;
      } else if (hourNum > currentHour) {
        targetHourIndex = 0;
        break;
      }
    }
    
    // Handle edge cases
    if (targetHourIndex === -1) {
      targetHourIndex = currentHour > 21 ? HOURS.length - 1 : 0;
    }
    
    if (targetHourIndex >= 0) {
      const scrollPosition = targetHourIndex * 68;
      containerRef.current.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      });
    }
  }, [currentTime]);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  const content = (
    <div 
      ref={containerRef}
      className={`space-y-1 ${className} max-h-[600px] overflow-y-auto`}
    >
        {HOURS.map((disp) => (
          <Droppable key={disp} droppableId={`hour-${disp}`}>
            {(provided, snapshot) => (
              <div
                className={`relative flex items-start gap-4 py-2 h-[68px] border-t border-gray-200 first:border-t-0 transition-colors ${
                  snapshot.isDraggingOver ? 'bg-indigo-50 border-indigo-200' : ''
                }`}
              >
                {/* Enhanced time label with better typography */}
                <div className="w-16 shrink-0 flex flex-col items-end text-right pt-1">
                  <span className="text-sm font-medium text-gray-900 leading-none">{disp}</span>
                  <span className="text-xs text-gray-500 mt-0.5">
                    {disp === currentHourDisplay ? 'Now' : ''}
                  </span>
                </div>
                
                <ul
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex-1 relative min-h-[60px] overflow-visible"
                  onClick={(e) => {
                    // Prevent click-to-create during drag or resize to avoid interference
                    if (effectiveDragging || resizingTask) return;
                    handleTimeSlotClick(disp);
                  }}
                >
                  {/* Empty time slot indicator */}
                  {hourlyPlan[disp].length === 0 && creatingTaskAt !== disp && (
                    <li className={`absolute inset-0 flex items-center justify-center group ${(effectiveDragging || resizingTask) ? 'pointer-events-none' : 'cursor-pointer'} hover:bg-theme-surface-hover/50 rounded-lg transition-colors`}>
                      <div className="flex items-center gap-2 text-theme-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus size={14} />
                        <span className="text-xs font-medium">Add task</span>
                      </div>
                    </li>
                  )}
                  
                  {/* Task creation form */}
                  {creatingTaskAt === disp && (
                    <li className="absolute inset-0 flex items-center p-1">
                      <div className="flex-1 bg-theme-widget-bg border border-theme-primary-200 rounded-lg p-2 shadow-sm">
                        {availableBuckets.length > 0 && (
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-xs text-gray-600 font-medium min-w-0">Bucket:</span>
                            <select
                              value={taskBucket}
                              onChange={(e) => setTaskBucket(e.target.value)}
                              className="flex-1 rounded border border-gray-300 px-1 py-0.5 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                            >
                              {availableBuckets.map(bucket => (
                                <option key={bucket} value={bucket}>{bucket}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={newTaskContent}
                            onChange={(e) => setNewTaskContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreateTaskAtTime(disp);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                handleCancelCreation();
                              }
                            }}
                            placeholder="What needs to be done?"
                            className="flex-1 text-xs bg-transparent border-none outline-none placeholder-theme-text-tertiary"
                            autoFocus
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateTaskAtTime(disp);
                            }}
                            disabled={isCreatingTask}
                            className="px-2 py-0.5 text-xs font-medium text-theme-primary-600 hover:text-theme-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {isCreatingTask ? 'Adding...' : 'Add'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelCreation();
                            }}
                            className="px-1 py-0.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </li>
                  )}
                  
                  {hourlyPlan[disp].map((t, index) => {
                    const taskCount = hourlyPlan[disp].length;
                    // Better spacing calculation for multiple tasks
                    const taskWidth = taskCount > 1 ? `${Math.floor(100 / taskCount) - 2}%` : '100%';
                    const leftOffset = taskCount > 1 ? `${(index * Math.floor(100 / taskCount)) + 1}%` : '0%';
                    
                    return (
                    <Draggable 
                      key={t.id} 
                      draggableId={t.id.toString()} 
                      index={index} 
                      isDragDisabled={!!resizingTask || (resizingTask?.taskId === t.id)}
                    >
                      {(prov, dragSnapshot) => {
                        const isResizing = resizingTask?.taskId === t.id;
                        const taskDuration = isResizing ? resizingTask.currentDuration : t.duration ?? 60;
                        const isDraggingNow = dragSnapshot.isDragging;
                        
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
                            zIndex: isResizing ? 1000 : (isDraggingNow ? 1000 : index + 1),
                            ...(isResizing ? { transform: 'none', transition: 'none' } : {}),
                          }}
                          onClick={(e) => e.stopPropagation()}
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
                              {/* Improved time range typography */}
                              <div className="text-xs font-medium text-indigo-600 leading-tight mb-1 tracking-wide">
                                {disp} – {calculateEndTime(disp, resizingTask?.taskId === t.id ? resizingTask.currentDuration : t.duration ?? 60)}
                              </div>
                              {/* Enhanced task title */}
                              <div className="font-semibold text-gray-900 truncate text-sm leading-tight">
                                {t.content}
                              </div>
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
                                onMouseDown={(e) => startResize(e, disp, t.id)}
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
                {showTimeIndicator && disp === currentHourDisplay && (
                  <div
                    className="absolute left-0 right-0 pointer-events-none flex items-center z-10"
                    style={{ top: `${20 + (currentTime.getMinutes() / 60) * 80}%` }}
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
        ))}
    </div>
  );
  if (wrapWithContext) {
    return (
      <DragDropContext onDragStart={() => setDragging(true)} onDragEnd={handleDragEnd}>
        {content}
      </DragDropContext>
    );
  }
  return content;
}
