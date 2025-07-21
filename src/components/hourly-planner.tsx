"use client";

// Stand-alone hourly planner component reused by TaskSidePanel and Calendar Day view
// -----------------------------------------------------------------------------
// NOTE: For the initial extraction we only replicate the UI skeleton and resize /
// drag-resize behaviour. Drag-and-drop between external lists will be wired up in
// a follow-up step once IntegratedCalendar needs that capability.

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useTasksContext } from "@/contexts/tasks-context";
import { X } from "lucide-react";
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
const HOUR_HEIGHT = 48; // px that represents one hour
const hours = Array.from({ length: 15 }, (_, i) => {
  const h = 7 + i;
  return `${h % 12 || 12}${h < 12 ? "AM" : "PM"}`;
});

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function HourlyPlanner({ className = "" }: { className?: string }) {
  const {
    dailyTasks,
    batchUpdateTasks,
    deleteTask,
  } = useTasksContext();
  
  // Build hourly plan from filtered daily tasks
  const hourlyPlan = useMemo(() => {
    console.log('⏰ HourlyPlanner Debug:', {
      dailyTasksCount: dailyTasks.length,
      dailyTasks: dailyTasks.map(t => ({ id: t.id, content: t.content, hourSlot: t.hourSlot, due: t.due?.date }))
    });
    
    const plan: Record<string, PlannerItem[]> = {};
    hours.forEach((h) => (plan[h] = []));
    
    // Only include tasks that have an hourSlot (are scheduled in the planner)
    dailyTasks.forEach((t) => {
      // Skip tasks without hourSlot - they shouldn't appear in the hourly planner
      if (!t.hourSlot) {
        console.log('⏭️ Skipping task without hourSlot:', { task: t.content, id: t.id });
        return;
      }
      
      let slot = t.hourSlot as string;
      // Clean up slot format - remove "hour-" prefix if present
      slot = slot.replace('hour-', '');
      
      if (!plan[slot]) {
        console.log('⚠️ Unknown slot format:', { slot, originalSlot: t.hourSlot, task: t.content });
        slot = "7AM"; // fallback
      }
      
      plan[slot].push({
        id: t.id.toString(),
        content: t.content,
        duration: t.duration ?? 60,
      });
      console.log('✅ Added task to slot:', { task: t.content, slot, originalSlot: t.hourSlot, id: t.id });
    });
    
    const planSummary = Object.entries(plan).map(([hour, tasks]) => ({ hour, count: tasks.length, tasks: tasks.map(t => t.content) }));
    console.log('📋 Final hourly plan summary:', JSON.stringify(planSummary, null, 2));
    
    // Check if 8PM exists and has tasks
    if (plan['8PM']) {
      console.log('🌆 8PM slot found with tasks:', plan['8PM']);
    } else {
      console.log('⚠️ 8PM slot missing or empty');
    }
    return plan;
  }, [dailyTasks]);

  // Resize helpers ------------------------------------------------------------
  const [resizingTask, setResizingTask] = useState<{
    taskId: string;
    hour: string;
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
    setResizingTask({ taskId, hour });

    function onMove(ev: MouseEvent) {
      if (!resizeStartRef.current) return;
      const delta = ev.clientY - resizeStartRef.current.y;
      // Round to nearest 15-min increment, minimum 15
      const minutes = Math.max(
        15,
        Math.round((resizeStartRef.current.duration + (delta / HOUR_HEIGHT) * 60) / 15) * 15,
      );
      // Persist via context so other components update optimistically
      batchUpdateTasks([
        { taskId, updates: { duration: minutes } as any },
      ]);

    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setResizingTask(null);
      resizeStartRef.current = null;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Remove task from hourly planner (with option to delete entirely)
  const removeTaskFromPlanner = (taskId: string, permanentDelete = false) => {
    console.log('🗑️ Removing task from planner:', { taskId, permanentDelete });
    
    if (permanentDelete) {
      // Permanently delete the task
      deleteTask(taskId).catch(error => {
        console.error('Failed to delete task:', error);
      });
    } else {
      // Just clear the hourSlot to remove from planner
      batchUpdateTasks([
        { taskId, updates: { hourSlot: null } as any },
      ]);
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

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className={`space-y-2 ${className}`}>
        {hours.map((disp) => (
          <Droppable key={disp} droppableId={`hour-${disp}`}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="relative flex items-start gap-3 py-3 min-h-[72px] border-t border-dashed border-[#C4D7FF] first:border-t-0"
              >
                <span className="w-14 text-xs text-gray-500 shrink-0">{disp}</span>
                <ul className="flex-1 flex flex-col gap-3">
                  {hourlyPlan[disp].map((t, index) => (
                    <Draggable key={t.id} draggableId={t.id} index={index} isDragDisabled={!!resizingTask}>
                      {(prov) => (
                        <li
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          {...prov.dragHandleProps}
                          style={{
                            ...prov.draggableProps.style,
                            ...(resizingTask?.taskId === t.id ? { transform: "none", transition: "none" } : {}),
                            height: `${((t.duration ?? 60) / 60) * HOUR_HEIGHT}px`,
                          }}
                          className="group relative flex items-start gap-2.5 px-3.5 py-3 bg-white border border-black/10 shadow-sm rounded-lg"
                        >
                          <div className="flex items-start gap-2.5 w-full h-full min-h-[36px]">
                            <div className="flex-shrink-0 mt-1.5">
                              <div className="w-2 h-2 bg-[#8A96FF] rounded-full" />
                            </div>
                            <div className="flex flex-col w-full justify-center min-w-0">
                              <div className="text-xs text-gray-500 leading-tight mb-0.5">
                                {/* Simplified time-range label – start time same as slot */}
                                {disp} – {/* End time computed from duration */}
                              </div>
                              <div className="font-semibold truncate">{t.content}</div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTaskFromPlanner(t.id, true); // true = permanently delete
                              }}
                              className="flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded p-1 transition-opacity"
                              title="Delete task permanently"
                            >
                              <X size={12} className="text-red-500" />
                            </button>
                          </div>
                          <div
                            onMouseDown={(e) => startResize(e, disp, t.id)}
                            className="absolute -bottom-1 left-0 right-0 h-2 cursor-ns-resize bg-purple-200 hover:bg-purple-300 rounded-b-md"
                          />
                        </li>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </ul>

                {/* Current-time indicator */}
                {disp === currentHourDisplay && (
                  <div
                    className="absolute inset-x-0 pointer-events-none flex items-center"
                    style={{ top: `${(currentTime.getMinutes() / 60) * 100}%` }}
                  >
                    <span className="w-2.5 h-2.5 bg-[#8A96FF] rounded-full" />
                    <div className="flex-1 h-[2px] bg-[#8A96FF]" />
                  </div>
                )}
              </div>
            )}
          </Droppable>
        ))}
    </div>
  );
}
