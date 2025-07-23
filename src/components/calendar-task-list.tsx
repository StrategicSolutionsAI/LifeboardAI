"use client";

import React, { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { ChevronRight, ChevronDown, ChevronLeft } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useTasksContext } from "@/contexts/tasks-context";

interface CalendarTaskListProps {
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
}

export function CalendarTaskList({ selectedDate, onDateChange }: CalendarTaskListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDailyCollapsed, setIsDailyCollapsed] = useState(false);
  const [isOpenCollapsed, setIsOpenCollapsed] = useState(false);
  const [taskView, setTaskView] = useState<'Today' | 'Upcoming' | 'Master List'>('Today');

  // Use unified task context
  const {
    dailyVisibleTasks, // Tasks for selected date without hourSlot
    allTasks,
    loading,
    createTask,
    toggleTaskCompletion,
    batchUpdateTasks,
  } = useTasksContext();

  // Filter tasks for display
  const openTasksToShow = useMemo(() => 
    allTasks.filter(t => !t.completed && !t.hourSlot), 
    [allTasks]
  );

  // New task input state
  const [newDailyTask, setNewDailyTask] = useState("");
  const [newOpenTask, setNewOpenTask] = useState("");

  const handleAddDailyTask = async () => {
    if (newDailyTask.trim()) {
      const dateStr = `${selectedDate.getFullYear()}-${String(
        selectedDate.getMonth() + 1
      ).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
      await createTask(newDailyTask, dateStr);
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
      return;
    }

    // Handle moves to/from hourly planner (if calendar has hourly view)
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

    if (isHour(source.droppableId) && destination.droppableId === 'dailyTasks') {
      // Hour slot → Daily tasks: Remove hourSlot to unschedule
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: undefined } }
      ]).catch(error => {
        console.error('Failed to remove task hourSlot:', error);
      });
      return;
    }

    if (isHour(source.droppableId) && isHour(destination.droppableId)) {
      // Hour slot → Different hour slot: Change hourSlot
      const dstHour = hourKey(destination.droppableId);
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour } }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }

    // Handle moves between daily and open tasks
    if (source.droppableId === 'openTasks' && destination.droppableId === 'dailyTasks') {
      // Open task → Daily: Set due date
      const dateStr = `${selectedDate.getFullYear()}-${String(
        selectedDate.getMonth() + 1
      ).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
      
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: { date: dateStr } } }
      ]).catch(error => {
        console.error('Failed to update task due date:', error);
      });
      return;
    }

    if (source.droppableId === 'dailyTasks' && destination.droppableId === 'openTasks') {
      // Daily task → Open: Remove due date
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: undefined } }
      ]).catch(error => {
        console.error('Failed to remove task due date:', error);
      });
      return;
    }
  }

  if (isCollapsed) {
    return (
      <div className="w-12 bg-white border border-gray-100 rounded-lg shadow-sm p-2">
        <button 
          onClick={() => setIsCollapsed(false)}
          className="p-1 hover:bg-gray-100 rounded transition-colors w-full flex justify-center"
          aria-label="Expand task list"
        >
          <ChevronLeft size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[400px] bg-white border border-gray-100 rounded-lg shadow-sm p-4 flex flex-col h-full">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Tasks</h3>
        <button 
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label="Collapse task list"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Task view toggle */}
      <div className="mb-4">
        <div className="flex rounded-full border border-[#E2E6F6] bg-white p-1 w-full shadow-sm">
          {(['Today','Upcoming','Master List'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTaskView(tab)}
              className={`flex-1 rounded-full px-4 py-1 text-sm font-semibold transition-colors ${
                taskView === tab
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Task lists with drag & drop */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <DragDropContext onDragEnd={handleDragEnd}>
          {taskView === 'Today' && (
            <>
              {/* Daily tasks */}
              <Droppable droppableId="dailyTasks">
                {(provided: any) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex flex-col"
                  >
                    <div
                      className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2 cursor-pointer select-none"
                      onClick={() => setIsDailyCollapsed((c) => !c)}
                    >
                      <span>Tasks for {format(selectedDate, 'MMM d, yyyy')}</span>
                      {isDailyCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </div>

                    <ul
                      className="space-y-2 text-sm text-gray-700 pr-1 transition-[max-height] duration-200 overflow-y-auto"
                      style={{ maxHeight: isDailyCollapsed ? 0 : '12rem' }}
                    >
                      {loading && dailyVisibleTasks.length === 0 ? (
                        <li className="text-gray-500">Loading…</li>
                      ) : null}

                      {!loading && dailyVisibleTasks.length === 0 ? (
                        <li className="text-gray-500">No tasks for today</li>
                      ) : null}

                      {dailyVisibleTasks.map((t: any, index: number) => (
                        <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                          {(provided: any) => (
                            <li
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={provided.draggableProps.style}
                              className="flex items-start gap-2 px-3 py-3 bg-white border border-black/10 shadow-sm rounded-lg hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                            >
                              <input
                                type="checkbox"
                                aria-label={t.content}
                                checked={t.completed ?? false}
                                onChange={() => toggleTaskCompletion(t.id.toString())}
                                className={`${t.completed ? 'accent-purple-600' : 'accent-indigo-500'} mt-0.5`}
                              />
                              <span className={t.completed ? 'line-through text-gray-400' : ''}>{t.content}</span>
                            </li>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </ul>
                  </div>
                )}
              </Droppable>

              {/* Add task to daily list */}
              {!isDailyCollapsed && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    placeholder="Add task for today…"
                    value={newDailyTask}
                    onChange={(e) => setNewDailyTask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddDailyTask(); }}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    onClick={handleAddDailyTask}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Add
                  </button>
                </div>
              )}
            </>
          )}

          {/* Master tasks (all open tasks) */}
          <div className={`mt-4 ${taskView === 'Today' ? '' : 'mt-0'}`}>
            <div
              className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2 cursor-pointer select-none"
              onClick={() => setIsOpenCollapsed((c) => !c)}
            >
              <span>All Open Tasks</span>
              {isOpenCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </div>
            
            <Droppable droppableId="openTasks">
              {(provided: any) => (
                <ul
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-2 text-sm text-gray-700 pr-1 transition-[max-height] duration-200 overflow-y-auto"
                  style={{ maxHeight: isOpenCollapsed ? 0 : '16rem' }}
                >
                  {loading && openTasksToShow.length === 0 ? (
                    <li className="text-gray-500">Loading…</li>
                  ) : null}

                  {!loading && openTasksToShow.length === 0 ? (
                    <li className="text-gray-500">No open tasks</li>
                  ) : null}

                  {openTasksToShow.map((t: any, index: number) => (
                    <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                      {(provided: any) => (
                        <li
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={provided.draggableProps.style}
                          className="flex items-start gap-2 px-3 py-3 bg-white border border-black/10 shadow-sm rounded-lg hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                        >
                          <input
                            type="checkbox"
                            aria-label={t.content}
                            checked={t.completed ?? false}
                            onChange={() => toggleTaskCompletion(t.id.toString())}
                            className={`${t.completed ? 'accent-purple-600' : 'accent-indigo-500'} mt-0.5`}
                          />
                          <span className={t.completed ? 'line-through text-gray-400' : ''}>{t.content}</span>
                        </li>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </ul>
              )}
            </Droppable>

            {/* Add open task */}
            {!isOpenCollapsed && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Add open task…"
                  value={newOpenTask}
                  onChange={(e) => setNewOpenTask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddOpenTask(); }}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button
                  onClick={handleAddOpenTask}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
