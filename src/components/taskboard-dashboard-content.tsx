"use client";

import React, { useState, useMemo } from "react";
import { format, addDays, isSameDay, parse } from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useTasksContext } from "@/contexts/tasks-context";
import { Skeleton } from "@/components/ui/skeleton";
import HourlyPlanner from "./hourly-planner";

interface TaskboardDashboardContentProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

// Loading skeleton for tasks
function TaskSkeleton() {
  return (
    <li className="flex items-start gap-3 px-4 py-4 bg-white border border-black/10 shadow-sm rounded-lg">
      <Skeleton className="w-4 h-4 mt-0.5 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </li>
  );
}

// Error display component
function TaskError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
      <AlertCircle size={16} />
      <span>Failed to load tasks</span>
      <button 
        onClick={onRetry}
        className="ml-auto text-red-600 hover:text-red-800 underline"
      >
        Retry
      </button>
    </div>
  );
}

export function TaskboardDashboardContent({ selectedDate, onDateChange }: TaskboardDashboardContentProps) {
  // Use unified task context
  const {
    dailyVisibleTasks,
    allTasks: allTodoistTasks,
    upcomingTasks,
    loading: isLoadingTasks,
    error,
    createTask,
    toggleTaskCompletion,
    batchUpdateTasks,
    refetch,
  } = useTasksContext();

  // Use dailyVisibleTasks from context (no hourSlot)
  const todoistTasks = dailyVisibleTasks;

  // UI state
  const [taskView, setTaskView] = useState<"Today" | "Upcoming" | "Master List">("Today");
  const [isDailyCollapsed, setIsDailyCollapsed] = useState(false);
  const [isOpenCollapsed, setIsOpenCollapsed] = useState(false);
  const [isPlannerCollapsed, setIsPlannerCollapsed] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // New task input state
  const [newDailyTask, setNewDailyTask] = useState('');
  const [newOpenTask, setNewOpenTask] = useState('');
  const [newUpcomingTask, setNewUpcomingTask] = useState('');
  const [upcomingTaskDate, setUpcomingTaskDate] = useState('');
  const [isCompletingTask, setIsCompletingTask] = useState<Record<string, boolean>>({});

  // Date navigation
  const [date, setDate] = useState(selectedDate);
  const selectedDateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);
  
  function handleDateChange(newDate: Date) {
    const d = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
    setDate(d);
    onDateChange(d);
  }

  // Calendar utilities
  const getWeekDays = () => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay()); // move to Sunday
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  // Task creation handlers
  const handleAddDailyTask = async () => {
    if (newDailyTask.trim()) {
      await createTask(newDailyTask.trim(), selectedDateStr);
      setNewDailyTask('');
    }
  };

  const handleAddOpenTask = async () => {
    if (newOpenTask.trim()) {
      await createTask(newOpenTask.trim(), null);
      setNewOpenTask('');
    }
  };

  const handleAddUpcomingTask = async () => {
    if (newUpcomingTask.trim() && upcomingTaskDate) {
      await createTask(newUpcomingTask, upcomingTaskDate);
      setNewUpcomingTask('');
      setUpcomingTaskDate('');
    }
  };

  // Task completion handler
  const handleToggleTaskCompletion = async (taskId: string) => {
    setIsCompletingTask(prev => ({ ...prev, [taskId]: true }));
    try {
      await toggleTaskCompletion(taskId);
    } finally {
      setIsCompletingTask(prev => ({ ...prev, [taskId]: false }));
    }
  };

  // Drag state to improve UX
  const [isDragging, setIsDragging] = useState(false);

  // Drag and drop handler
  const handleDragEnd = (result: DropResult) => {
    // Ignore drops if a resize operation is active
    if (typeof document !== 'undefined' && document.body.classList.contains('lb-resizing')) {
      setIsDragging(false);
      return;
    }
    setIsDragging(false);
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // Helper functions
    const isHour = (id: string) => id.startsWith('hour-');
    const hourKey = (id: string) => id.replace('hour-', '');

    // Handle moves to/from hourly planner
    if (source.droppableId === 'dailyTasks' && isHour(destination.droppableId)) {
      // Daily task → Hour slot: Set the hourSlot to schedule the task
      const dstHour = destination.droppableId; // Keep the full "hour-7AM" format
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour }, occurrenceDate: selectedDateStr }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }

    if ((source.droppableId === 'openTasks' || source.droppableId === 'upcomingTasks') && isHour(destination.droppableId)) {
      // Open/Upcoming task → Hour slot: Set the hourSlot to schedule the task  
      const dstHour = destination.droppableId; // Keep the full "hour-7AM" format
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour }, occurrenceDate: selectedDateStr }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }

    if (isHour(source.droppableId) && destination.droppableId === 'dailyTasks') {
      // Hour slot → Daily list: Remove hourSlot to unschedule the task
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: null as any }, occurrenceDate: selectedDateStr }
      ]).catch(error => {
        console.error('Failed to remove task hourSlot:', error);
      });
      return;
    }

    if (isHour(source.droppableId) && (destination.droppableId === 'openTasks' || destination.droppableId === 'upcomingTasks')) {
      // Hour slot → Open/Upcoming list: Remove hourSlot to unschedule the task
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: null as any }, occurrenceDate: selectedDateStr }
      ]).catch(error => {
        console.error('Failed to remove task hourSlot:', error);
      });
      return;
    }

    if (isHour(source.droppableId) && isHour(destination.droppableId)) {
      // Hour slot → Different hour slot: Update the hourSlot
      const dstHour = destination.droppableId; // Keep the full "hour-7AM" format
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour }, occurrenceDate: selectedDateStr }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }
  };

  const openTasksToShow = useMemo(() => {
    return allTodoistTasks.filter(t => !t.completed);
  }, [allTodoistTasks]);

  return (
    <aside
      className={`relative -mt-12 flex-shrink-0 transition-[width] duration-300 ease-in-out ${
        isSidebarCollapsed ? 'w-0' : 'w-[400px]'
      }`}
    >
      <button
        type="button"
        onClick={() => setIsSidebarCollapsed((prev) => !prev)}
        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={`absolute top-4 left-0 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500`}
      >
        {isSidebarCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <div
        className={`absolute inset-y-0 right-0 w-[400px] transition-transform duration-300 ease-in-out ${
          isSidebarCollapsed ? 'translate-x-full pointer-events-none opacity-0' : 'translate-x-0 pointer-events-auto opacity-100'
        }`}
        aria-hidden={isSidebarCollapsed}
      >
        <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm h-full flex flex-col">
          {/* Collapse toggle */}
          <div className="flex items-center mb-4">
            <h3 className="text-sm font-medium text-gray-900">
              {format(date, "MMMM yyyy")}
            </h3>
          </div>

          {!isSidebarCollapsed && (
          <>
            {/* Week navigation */}
            <div className="flex gap-1 text-gray-500 mb-4">
              <button onClick={() => handleDateChange(addDays(date, -7))} aria-label="Previous week">&lt;</button>
              <button onClick={() => handleDateChange(addDays(date, 7))} aria-label="Next week">&gt;</button>
            </div>

            {/* Week strip */}
            <div className="flex justify-between gap-3 overflow-x-auto pb-2 mb-4">
              {getWeekDays().map((day, idx) => (
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

            {/* Task view toggle */}
            <div className="mb-4">
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
            <div className="flex-1 overflow-y-auto flex flex-col">
              <DragDropContext 
                onDragStart={() => setIsDragging(true)}
                onDragEnd={handleDragEnd}
              >
                {/* Today view */}
                {taskView === "Today" && (
                  <>
                    {/* Daily tasks */}
                    <Droppable droppableId="dailyTasks">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col">
                          <div
                            className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2 cursor-pointer select-none"
                            onClick={() => setIsDailyCollapsed((c) => !c)}
                          >
                            <span>Tasks for {format(selectedDate, "MMM d")}</span>
                            {isDailyCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          </div>

                          <ul
                            className="space-y-3 text-sm text-gray-700 overflow-y-auto pr-1 transition-[max-height] duration-200"
                            style={{ maxHeight: isDailyCollapsed ? 0 : "10rem" }}
                          >
                            {error ? (
                              <TaskError error={error} onRetry={refetch} />
                            ) : isLoadingTasks && todoistTasks.length === 0 ? (
                              Array.from({ length: 3 }).map((_, i) => <TaskSkeleton key={i} />)
                            ) : !isLoadingTasks && todoistTasks.length === 0 ? (
                              <li className="text-gray-500 text-center py-4">No tasks for today</li>
                            ) : (
                              todoistTasks.map((t: any, index: number) => (
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
                                        disabled={isCompletingTask[t.id]}
                                        onChange={() => handleToggleTaskCompletion(t.id.toString())}
                                        className={`${t.completed ? "accent-purple-600" : "accent-indigo-500"} mt-0.5`}
                                      />
                                      <span className={t.completed ? "line-through text-gray-400" : ""}>{t.content}</span>
                                    </li>
                                  )}
                                </Draggable>
                              ))
                            )}
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

                {/* Upcoming view */}
                {taskView === "Upcoming" && (
                  <>
                    <div
                      className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2 cursor-pointer select-none"
                      onClick={() => setIsOpenCollapsed((c) => !c)}
                    >
                      <span>Upcoming tasks ({upcomingTasks.length})</span>
                      {isOpenCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </div>

                    <Droppable droppableId="upcomingTasks">
                      {(provided) => (
                        <ul
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="space-y-3 text-sm text-gray-700 overflow-y-auto pr-1 transition-[max-height] duration-200"
                          style={{ maxHeight: isOpenCollapsed ? 0 : "12rem" }}
                        >
                          {error ? (
                            <TaskError error={error} onRetry={refetch} />
                          ) : isLoadingTasks && upcomingTasks.length === 0 ? (
                            Array.from({ length: 3 }).map((_, i) => <TaskSkeleton key={i} />)
                          ) : !isLoadingTasks && upcomingTasks.length === 0 ? (
                            <li className="text-gray-500 text-center py-4">No upcoming tasks</li>
                          ) : (
                            upcomingTasks.map((t: any, index: number) => (
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
                                      disabled={isCompletingTask[t.id]}
                                      onChange={() => handleToggleTaskCompletion(t.id.toString())}
                                      className={`${t.completed ? "accent-purple-600" : "accent-indigo-500"} mt-0.5`}
                                    />
                                    <div className="flex-1">
                                      <span className={t.completed ? "line-through text-gray-400" : ""}>{t.content}</span>
                                      {t.due?.date && (
                                        <div className="text-xs text-gray-500 mt-1">
                                          Due {format(parse(t.due.date, 'yyyy-MM-dd', new Date()), "MMM d, yyyy")}
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                )}
                              </Draggable>
                            ))
                          )}
                          {provided.placeholder}
                        </ul>
                      )}
                    </Droppable>

                    {/* Add new upcoming task */}
                    {!isOpenCollapsed && (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          placeholder="Add upcoming task…"
                          value={newUpcomingTask}
                          onChange={(e) => setNewUpcomingTask(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && upcomingTaskDate && handleAddUpcomingTask()}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={upcomingTaskDate}
                            onChange={(e) => setUpcomingTaskDate(e.target.value)}
                            min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                          />
                          <button 
                            onClick={handleAddUpcomingTask}
                            disabled={!newUpcomingTask.trim() || !upcomingTaskDate}
                            className="text-sm text-indigo-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Master List view */}
                {taskView === "Master List" && (
                  <>
                    <div className="flex items-center justify-between text-sm font-medium text-gray-900 mb-2">
                      <div 
                        className="flex items-center gap-2 cursor-pointer select-none flex-1"
                        onClick={() => setIsOpenCollapsed((c) => !c)}
                      >
                        <span>All open tasks ({openTasksToShow.length})</span>
                        {isOpenCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          refetch();
                        }}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Refresh tasks"
                      >
                        <RefreshCw size={14} className={isLoadingTasks ? "animate-spin" : ""} />
                      </button>
                    </div>

                    <Droppable droppableId="openTasks">
                      {(provided) => (
                        <ul
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="space-y-3 text-sm text-gray-700 overflow-y-auto pr-1 transition-[max-height] duration-200"
                          style={{ maxHeight: isOpenCollapsed ? 0 : "40rem" }}
                        >
                          {error ? (
                            <TaskError error={error} onRetry={refetch} />
                          ) : isLoadingTasks && openTasksToShow.length === 0 ? (
                            Array.from({ length: 3 }).map((_, i) => <TaskSkeleton key={i} />)
                          ) : !isLoadingTasks && openTasksToShow.length === 0 ? (
                            <li className="text-gray-500 text-center py-4">No open tasks</li>
                          ) : (
                            openTasksToShow.map((t: any, index: number) => (
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
                                      disabled={isCompletingTask[t.id]}
                                      onChange={() => handleToggleTaskCompletion(t.id.toString())}
                                      className={`${t.completed ? "accent-purple-600" : "accent-indigo-500"} mt-0.5`}
                                    />
                                    <div className="flex-1">
                                      <span className={t.completed ? "line-through text-gray-400" : ""}>{t.content}</span>
                                      {t.due?.date && (
                                        <div className="text-xs text-gray-500 mt-1">
                                          Due {format(parse(t.due.date, 'yyyy-MM-dd', new Date()), "MMM d, yyyy")}
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                )}
                              </Draggable>
                            ))
                          )}
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

                {/* Hourly planner */}
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
                      <HourlyPlanner showTimeIndicator={true} allowResize={true} isDragging={isDragging} />
                  </div>
                 </>
                )}
              </DragDropContext>
            </div>
          </>
          )}
        </div>
      </div>
    </aside>
  );
}
