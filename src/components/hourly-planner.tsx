"use client";

// Enhanced hourly planner component with improved UX
// Features: better visual hierarchy, time ranges, quick actions, and intuitive interactions

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useTasksContext } from "@/contexts/tasks-context";
import { X, Clock, Plus, Edit3, Copy } from "lucide-react";
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
const hours = Array.from({ length: 15 }, (_, i) => {
  const h = 7 + i;
  return `${h % 12 || 12}${h < 12 ? "AM" : "PM"}`;
});

// Helper function to calculate end time
const calculateEndTime = (startHour: string, durationMinutes: number): string => {
  const hourIndex = hours.indexOf(startHour);
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
  } = useTasksContext();
  
  // Ref for the scrollable container
  const containerRef = useRef<HTMLDivElement>(null);
  
  
  // Build hourly plan from scheduled tasks
  const hourlyPlan = useMemo(() => {
    const plan: Record<string, PlannerItem[]> = {};
    hours.forEach((h) => (plan[h] = []));
    
    // Process only tasks that have been scheduled (have hourSlot)
    scheduledTasks.forEach((t) => {
      let slot = t.hourSlot as string;
      // Clean up slot format - remove "hour-" prefix if present
      slot = slot.replace('hour-', '');
      
      // Validate slot exists in our hours array
      if (!hours.includes(slot)) {
        console.warn(`Invalid hourSlot "${slot}" for task "${t.content}", skipping`);
        return;
      }
      
      plan[slot].push({
        id: t.id.toString(),
        content: t.content,
        duration: t.duration ?? 60,
      });
    });
    
    return plan;
  }, [scheduledTasks, hours]);

  // Resize helpers ------------------------------------------------------------
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

  function startResize(e: React.MouseEvent, hour: string, taskId: string) {
    e.stopPropagation();
    e.preventDefault();

    const startY = e.clientY;
    const task = hourlyPlan[hour].find((t) => t.id === taskId);
    const startDuration = task?.duration ?? 60;
    resizeStartRef.current = { y: startY, duration: startDuration, taskId, hour };
    setResizingTask({ taskId, hour, currentDuration: startDuration });

    function onMove(ev: MouseEvent) {
      if (!resizeStartRef.current) return;
      const delta = ev.clientY - resizeStartRef.current.y;
      // Round to nearest 15-min increment, minimum 15
      const minutes = Math.max(
        15,
        Math.round((resizeStartRef.current.duration + (delta / HOUR_HEIGHT) * 60) / 15) * 15,
      );
      
      // Only update local state during resize - don't call API until mouse up
      setResizingTask(prev => prev ? { ...prev, currentDuration: minutes } : null);
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      
      // Only now update the server with final duration using current resizing state
      if (resizingTask?.currentDuration) {
        // Update server only once at the end
        batchUpdateTasks([
          { taskId, updates: { duration: resizingTask.currentDuration } as any },
        ]);
      }
      
      setResizingTask(null);
      resizeStartRef.current = null;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Remove task from hourly planner - simplified approach
  const removeTaskFromPlanner = async (taskId: string) => {
    if (!batchUpdateTasks) {
      console.error('❌ batchUpdateTasks function not available!');
      return;
    }
    
    try {
      // Use the context method directly - this should handle optimistic updates
      await batchUpdateTasks([{ taskId, updates: { hourSlot: undefined } }]);
    } catch (error) {
      console.error('❌ Failed to remove task from planner:', taskId, error);
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

  // Auto-scroll to current hour on mount and time changes
  useEffect(() => {
    if (!containerRef.current) return;
    
    const currentHour = currentTime.getHours();
    // Find the hour block to scroll to (current hour or one before if available)
    let targetHourIndex = -1;
    
    // Find current hour in our hours array (7 AM to 9 PM)
    for (let i = 0; i < hours.length; i++) {
      const hourNum = 7 + i; // Convert index to actual hour
      if (hourNum === currentHour) {
        // Scroll to the hour before current time, or current hour if it's the first
        targetHourIndex = Math.max(0, i - 1);
        break;
      } else if (hourNum > currentHour) {
        // Current time is before our range, scroll to first hour
        targetHourIndex = 0;
        break;
      }
    }
    
    // If current time is after our range (after 9 PM), scroll to last hour
    if (targetHourIndex === -1 && currentHour > 21) {
      targetHourIndex = hours.length - 1;
    }
    
    // If current time is before our range (before 7 AM), scroll to first hour
    if (targetHourIndex === -1 && currentHour < 7) {
      targetHourIndex = 0;
    }
    
    if (targetHourIndex >= 0) {
      // Calculate scroll position (each hour block is ~68px tall)
      const scrollPosition = targetHourIndex * 68;
      
      // Smooth scroll to the target position
      containerRef.current.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      });
    }
  }, [currentTime, hours]); // Re-run when time changes

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div 
      ref={containerRef}
      className={`space-y-1 ${className} max-h-[600px] overflow-y-auto`}
    >
        {hours.map((disp) => (
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
                  className="flex-1 relative h-[60px] overflow-visible"
                >
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
                                try {
                                  await deleteTask(t.id);
                                  console.log('✅ Task deleted successfully');
                                } catch (error) {
                                  console.error('❌ Failed to delete task:', error);
                                }
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
                  
                  {/* Empty state visual cue */}
                  {hourlyPlan[disp].length === 0 && !snapshot.isDraggingOver && (
                    <div className="flex-1 min-h-[44px] rounded-lg border-2 border-dashed border-theme-neutral-300 
                      flex items-center justify-center text-theme-text-quaternary text-xs
                      transition-colors hover:border-theme-neutral-400">
                      Drop tasks here
                    </div>
                  )}
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
