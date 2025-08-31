"use client";

// Enhanced hourly planner component with improved UX
// Features: better visual hierarchy, time ranges, quick actions, and intuitive interactions

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useTasksContext } from "@/contexts/tasks-context";
import { X, Plus } from "lucide-react";
import {
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";

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
}

export default function HourlyPlanner({ 
  className = "", 
  showTimeIndicator = true,
  allowResize = true 
}: HourlyPlannerProps) {
  const {
    scheduledTasks,
    batchUpdateTasks,
    deleteTask,
    createTask,
  } = useTasksContext();
  
  // Ref for the scrollable container
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State for inline task creation
  const [creatingTaskAt, setCreatingTaskAt] = useState<string | null>(null);
  const [newTaskContent, setNewTaskContent] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  
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
      // Get today's date for the task
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      
      console.log('Creating task:', { content: newTaskContent.trim(), date: dateStr, timeSlot });
      
      // Add to pending tasks for immediate display
      setPendingTasks(prev => [...prev, tempTask]);
      
      // Create the task via API
      const newTask = await createTask(newTaskContent.trim(), dateStr);
      
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

  const startResize = (e: React.MouseEvent, hour: string, taskId: string) => {
    e.stopPropagation();
    e.preventDefault();

    const task = hourlyPlan[hour].find((t) => t.id === taskId);
    const startDuration = task?.duration ?? 60;
    
    resizeStartRef.current = { 
      y: e.clientY, 
      duration: startDuration, 
      taskId, 
      hour 
    };
    setResizingTask({ taskId, hour, currentDuration: startDuration });

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizeStartRef.current) return;
      
      const delta = ev.clientY - resizeStartRef.current.y;
      const newDuration = Math.max(
        MIN_DURATION,
        Math.round((resizeStartRef.current.duration + (delta / HOUR_HEIGHT) * 60) / RESIZE_INCREMENT) * RESIZE_INCREMENT
      );
      
      setResizingTask(prev => prev ? { ...prev, currentDuration: newDuration } : null);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      
      if (resizingTask?.currentDuration) {
        batchUpdateTasks([{ taskId, updates: { duration: resizingTask.currentDuration } }]);
      }
      
      setResizingTask(null);
      resizeStartRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

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
  return (
    <div 
      ref={containerRef}
      className={`space-y-1 ${className} max-h-[600px] overflow-y-auto`}
    >
        {HOURS.map((disp) => (
          <Droppable key={disp} droppableId={`hour-${disp}`}>
            {(provided, snapshot) => (
              <div
                className={`relative flex items-start gap-4 py-2 h-[68px] border-t border-theme-neutral-200 first:border-t-0 transition-colors ${
                  snapshot.isDraggingOver ? 'bg-theme-primary-50 border-theme-primary-200' : ''
                }`}
              >
                {/* Enhanced time label with better typography */}
                <div className="w-16 shrink-0 flex flex-col items-end text-right pt-1">
                  <span className="text-sm font-medium text-theme-text-primary leading-none">{disp}</span>
                  <span className="text-xs text-theme-text-tertiary mt-0.5">
                    {disp === currentHourDisplay ? 'Now' : ''}
                  </span>
                </div>
                
                <ul
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex-1 relative min-h-[60px] overflow-visible"
                  onClick={() => handleTimeSlotClick(disp)}
                >
                  {/* Empty time slot indicator */}
                  {hourlyPlan[disp].length === 0 && creatingTaskAt !== disp && (
                    <li className="absolute inset-0 flex items-center justify-center group cursor-pointer hover:bg-theme-surface-hover/50 rounded-lg transition-colors">
                      <div className="flex items-center gap-2 text-theme-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus size={14} />
                        <span className="text-xs font-medium">Add task</span>
                      </div>
                    </li>
                  )}
                  
                  {/* Task creation form */}
                  {creatingTaskAt === disp && (
                    <li className="absolute inset-0 flex items-center p-2">
                      <div className="flex-1 flex items-center gap-2 bg-theme-widget-bg border border-theme-primary-200 rounded-lg p-3 shadow-sm">
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
                          className="flex-1 text-sm bg-transparent border-none outline-none placeholder-theme-text-tertiary"
                          autoFocus
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateTaskAtTime(disp);
                          }}
                          disabled={isCreatingTask}
                          className="px-2 py-1 text-xs font-medium text-theme-primary-600 hover:text-theme-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isCreatingTask ? 'Adding...' : 'Add'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelCreation();
                          }}
                          className="px-2 py-1 text-xs font-medium text-theme-text-tertiary hover:text-theme-text-secondary transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </li>
                  )}
                  
                  {hourlyPlan[disp].map((t, index) => {
                    const taskCount = hourlyPlan[disp].length;
                    const taskWidth = taskCount > 1 ? `${(100 / taskCount) - 1}%` : '100%'; // Small gap between tasks
                    const leftOffset = taskCount > 1 ? `${(index * 100) / taskCount}%` : '0%';
                    
                    return (
                    <Draggable key={t.id} draggableId={t.id} index={index} isDragDisabled={resizingTask?.taskId === t.id}>
                      {(prov, dragSnapshot) => {
                        const isResizing = resizingTask?.taskId === t.id;
                        const taskDuration = isResizing ? resizingTask.currentDuration : t.duration ?? 60;
                        
                        return (
                        <li
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          {...prov.dragHandleProps}
                          style={{
                            ...(isResizing ? {} : prov.draggableProps.style),
                            height: `${Math.max(20, (taskDuration / 60) * HOUR_HEIGHT)}px`,
                            position: 'absolute',
                            top: '0px',
                            left: leftOffset,
                            width: taskWidth,
                            zIndex: isResizing ? 1000 : (dragSnapshot.isDragging ? 1000 : index + 1),
                            transform: isResizing ? "none" : undefined,
                            transition: isResizing ? "none" : undefined,
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`group relative flex items-start gap-3 px-4 py-3 
                            bg-theme-widget-bg border border-theme-widget-border 
                            shadow-sm hover:shadow-md 
                            rounded-xl transition-all duration-200 
                            hover:border-theme-primary-400 hover:bg-theme-surface-hover
                            ${dragSnapshot.isDragging ? 'shadow-lg rotate-1 scale-105 border-theme-primary-500' : ''}
                            ${resizingTask?.taskId === t.id ? 'ring-2 ring-theme-primary-200' : ''}
                          `}
                        >
                          <div className="flex items-start gap-3 w-full h-full min-h-[32px]">
                            {/* Enhanced status indicator with brand colors */}
                            <div className="flex-shrink-0 mt-1">
                              <div className="w-2.5 h-2.5 bg-theme-primary-500 rounded-full ring-2 ring-theme-primary-200" />
                            </div>
                            
                            <div className="flex flex-col w-full justify-center min-w-0">
                              {/* Improved time range typography */}
                              <div className="text-xs font-medium text-theme-primary-600 leading-tight mb-1 tracking-wide">
                                {disp} – {calculateEndTime(disp, resizingTask?.taskId === t.id ? resizingTask.currentDuration : t.duration ?? 60)}
                              </div>
                              {/* Enhanced task title */}
                              <div className="font-semibold text-theme-text-primary truncate text-sm leading-tight">
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
                                className="h-2 w-8 cursor-ns-resize 
                                  bg-theme-primary-200 hover:bg-theme-primary-300 
                                  rounded-full transition-all duration-200
                                  opacity-0 group-hover:opacity-100
                                  flex items-center justify-center"
                              >
                                <div className="w-3 h-0.5 bg-theme-primary-600 rounded-full" />
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
                      <div className="w-3 h-3 bg-theme-error-500 rounded-full shadow-lg 
                        ring-2 ring-theme-error-200 animate-pulse" />
                      <div className="flex-1 h-0.5 bg-theme-error-500 shadow-sm" />
                      <div className="px-2 py-1 bg-theme-error-500 text-theme-text-inverse 
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
}
