/* eslint-disable */
"use client";

import React, { useState, useMemo, useCallback } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { ChevronRight, ChevronDown } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useTasksContext } from "@/contexts/tasks-context";
import HourlyPlanner from "./hourly-planner";

interface Task {
  id: string | number;
  content: string;
  completed: boolean;
  hourSlot?: string;
}

export function TaskSidePanel() {
  // Basic calendar / date state
  const [date, setDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const selectedDateStr = `${selectedDate.getFullYear()}-${String(
    selectedDate.getMonth() + 1
  ).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

  const handleDateChange = useCallback((newDate: Date) => {
    const d = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
    setDate(d);
    setSelectedDate(d);
  }, []);

  // Week days for the currently visible week
  const weekDays = useMemo(() => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay()); // move to Sunday
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [date]);

  // Use unified task context
  const {
    dailyVisibleTasks, // Tasks without hourSlot
    allTasks,
    loading,
    createTask,
    toggleTaskCompletion,
    batchUpdateTasks,
  } = useTasksContext();

  // Filter tasks for display
  const openTasksToShow = useMemo(() => 
    allTasks.filter(t => !t.completed), 
    [allTasks]
  );

  // New task input state
  const [newDailyTask, setNewDailyTask] = useState("");
  const [newOpenTask, setNewOpenTask] = useState("");

  const handleAddDailyTask = async () => {
    if (newDailyTask.trim()) {
      await createTask(newDailyTask, selectedDateStr);
      setNewDailyTask("");
    }
  };

  const handleAddOpenTask = async () => {
    if (newOpenTask.trim()) {
      await createTask(newOpenTask, null);
      setNewOpenTask("");
    }
  };

  // Unified drag and drop handler
  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // Helper functions
    const isHour = (id: string) => id.startsWith('hour-');
    const hourKey = (id: string) => id.replace('hour-', '');

    // Same list reorder - no API call needed for now
    if (source.droppableId === destination.droppableId && source.index !== destination.index) {
      // not implemented yet
      return;
    }

    // Handle moves to/from hourly planner
    if (source.droppableId === 'dailyTasks' && isHour(destination.droppableId)) {
      // Daily task → Hour slot: Set the hourSlot to schedule the task
      const dstHour = hourKey(destination.droppableId);
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour } }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }

    if (source.droppableId === 'openTasks' && isHour(destination.droppableId)) {
      // Open task → Hour slot: Set the hourSlot to schedule the task  
      const dstHour = hourKey(destination.droppableId);
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour } }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }

    if (isHour(source.droppableId) && destination.droppableId === 'dailyTasks') {
      // Hour slot → Daily list: Remove hourSlot to unschedule the task
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: undefined } }
      ]).catch(error => {
        console.error('Failed to remove task hourSlot:', error);
      });
      return;
    }

    if (isHour(source.droppableId) && destination.droppableId === 'openTasks') {
      // Hour slot → Open list: Remove hourSlot to unschedule the task
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: undefined } }
      ]).catch(error => {
        console.error('Failed to remove task hourSlot:', error);
      });
      return;
    }

    if (isHour(source.droppableId) && isHour(destination.droppableId)) {
      // Hour slot → Different hour slot: Update the hourSlot
      const dstHour = hourKey(destination.droppableId);
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour } }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }
  }

  // UI collapse controls
  const [taskView, setTaskView] = useState<"Today" | "Upcoming" | "Master List">("Today");
  const [isDailyCollapsed, setIsDailyCollapsed] = useState(false);
  const [isOpenCollapsed, setIsOpenCollapsed] = useState(false);
  const [isPlannerCollapsed, setIsPlannerCollapsed] = useState(false);

  return (
    <aside className="w-[400px] flex-shrink-0 -mt-12">
      <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm h-full flex flex-col">
        {/* Month header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">{format(date, "MMMM yyyy")}</h3>
          <div className="flex gap-1 text-gray-500">
            <button onClick={() => handleDateChange(addDays(date, -7))} aria-label="Previous week">&lt;</button>
            <button onClick={() => handleDateChange(addDays(date, 7))} aria-label="Next week">&gt;</button>
          </div>
        </div>

        {/* Week strip */}
        <div className="flex justify-between gap-3 overflow-x-auto pb-2">
          {weekDays.map((day, idx) => (
            <button
              key={idx}
              onClick={() => handleDateChange(day)}
              className={`flex flex-col items-center rounded-xl px-3 py-2 w-14 transition-colors ${
                isSameDay(day, selectedDate)
                  ? "bg-theme-primary text-white"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span className="text-lg font-semibold leading-none">{format(day, "d")}</span>
              <span className="text-xs leading-none mt-1">{format(day, "EEE")}</span>
            </button>
          ))}
        </div>

        {/* Toggle Today / Upcoming / Master */}
        <div className="mt-4">
          <div className="flex rounded-full border border-[#E2E6F6] bg-white p-1 w-full shadow-sm">
            {["Today", "Upcoming", "Master List"].map((tab) => (
              <button
                key={tab}
                onClick={() => setTaskView(tab as any)}
                className={`flex-1 rounded-full px-4 py-1 text-sm font-semibold transition-colors ${
                  taskView === tab
                    ? "bg-theme-primary text-white shadow"
                    : "text-theme-secondary hover:bg-gray-50 hover:text-theme-primary"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Lists */}
        <div className="mt-6 flex-1 overflow-hidden flex flex-col" style={{ transform: 'none' }}>
          <DragDropContext onDragEnd={handleDragEnd}>
            {/* Today view */}
            {taskView === "Today" && (
              <>
                {/* Daily tasks header */}
                <Droppable droppableId="dailyTasks">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col">
                      <div
                        className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2 cursor-pointer select-none"
                        onClick={() => setIsDailyCollapsed((c) => !c)}
                      >
                        <span>Todoist tasks on {format(selectedDate, "MMM d, yyyy")}</span>
                        {isDailyCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </div>

                      <ul
                        className="space-y-3 text-sm text-gray-700 overflow-y-auto pr-1 transition-[max-height] duration-200"
                        style={{ maxHeight: isDailyCollapsed ? 0 : "10rem" }}
                      >
                        {loading && dailyVisibleTasks.length === 0 && <li className="text-gray-500">Loading…</li>}
                        {!loading && dailyVisibleTasks.length === 0 && <li className="text-gray-500">No tasks</li>}

                        {dailyVisibleTasks.map((t: Task, index: number) => (
                          <Draggable key={t.id} draggableId={t.id.toString()} index={index}>
                            {(prov) => (
                              <li
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                style={prov.draggableProps.style}
                                className="flex items-start gap-3 px-4 py-4 bg-white border border-black/10 shadow-sm rounded-lg"
                              >
                                <input
                                  type="checkbox"
                                  aria-label={t.content}
                                  checked={t.completed ?? false}
                                  onChange={() => toggleTaskCompletion(t.id.toString())}
                                  className={`${t.completed ? "accent-purple-600" : "accent-indigo-500"} mt-0.5`}
                                />
                                <span className={t.completed ? "line-through text-gray-400" : ""}>{t.content}</span>
                              </li>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </ul>
                    </div>
                  )}
                </Droppable>

                {/* Add new daily task */}
                {!isDailyCollapsed && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Add task…"
                      value={newDailyTask}
                      onChange={(e) => setNewDailyTask(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddDailyTask()}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                    <button onClick={handleAddDailyTask} className="text-sm text-indigo-600 hover:underline">
                      Add
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Master List view */}
            {taskView === "Master List" && (
              <>
                <div
                  className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2 cursor-pointer select-none"
                  onClick={() => setIsOpenCollapsed((c) => !c)}
                >
                  <span>All open tasks</span>
                  {isOpenCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </div>

                <Droppable droppableId="openTasks">
                  {(provided) => (
                    <ul
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-3 text-sm text-gray-700 overflow-y-auto pr-1 transition-[max-height] duration-200"
                      style={{ maxHeight: isOpenCollapsed ? 0 : "12rem" }}
                    >
                      {loading && openTasksToShow.length === 0 && <li className="text-gray-500">Loading…</li>}
                      {!loading && openTasksToShow.length === 0 && <li className="text-gray-500">No tasks</li>}

                      {openTasksToShow.map((t: Task, index: number) => (
                        <Draggable key={t.id} draggableId={t.id.toString()} index={index}>
                          {(prov) => (
                            <li
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              style={prov.draggableProps.style}
                              className="flex items-start gap-3 px-4 py-4 bg-white border border-black/10 shadow-sm rounded-lg"
                            >
                              <input
                                type="checkbox"
                                aria-label={t.content}
                                checked={t.completed ?? false}
                                onChange={() => toggleTaskCompletion(t.id.toString())}
                                className={`${t.completed ? "accent-purple-600" : "accent-indigo-500"} mt-0.5`}
                              />
                              <span className={t.completed ? "line-through text-gray-400" : ""}>{t.content}</span>
                            </li>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </ul>
                  )}
                </Droppable>

                {/* Add new open task */}
                {!isOpenCollapsed && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Add task…"
                      value={newOpenTask}
                      onChange={(e) => setNewOpenTask(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddOpenTask()}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                    <button onClick={handleAddOpenTask} className="text-sm text-indigo-600 hover:underline">
                      Add
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Hourly planner - Unified component */}
            {taskView === "Today" && (
              <>
                <div
                  className="flex items-center justify-between text-sm font-medium text-gray-900 mt-4 mb-2 cursor-pointer select-none"
                  onClick={() => setIsPlannerCollapsed((c) => !c)}
                >
                  <span>Hourly Planner</span>
                  {isPlannerCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </div>
                <div
                  className="overflow-y-auto pr-1 transition-[max-height] duration-200"
                  style={{ maxHeight: isPlannerCollapsed ? 0 : "16rem" }}
                >
                  <HourlyPlanner showTimeIndicator={true} allowResize={true} />
                </div>
              </>
            )}
          </DragDropContext>
        </div>
      </div>
    </aside>
  );
}