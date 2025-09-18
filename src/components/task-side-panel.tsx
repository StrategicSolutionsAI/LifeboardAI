/* eslint-disable */
"use client";

import React, { useState, useMemo, useCallback } from "react";
import { format, addDays, isSameDay, parse } from "date-fns";
import { ChevronRight, ChevronDown, AlertCircle, RefreshCw, ListPlus } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useTasksContext } from "@/contexts/tasks-context";
import { Skeleton } from "@/components/ui/skeleton";
import HourlyPlanner from "./hourly-planner";
import { HomeProject, PROJECT_STATUS } from "@/types/home-projects";
import type { Task } from "@/hooks/use-tasks";

// Loading skeleton for tasks
function TaskSkeleton() {
  return (
    <li className="widget-container flex items-start gap-3 px-4 py-4">
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
    <div className="flex items-center gap-2 px-4 py-3 bg-theme-error-50 border border-theme-error-200 rounded-lg text-theme-error-700 text-sm">
      <AlertCircle size={16} />
      <span>Failed to load tasks</span>
      <button 
        onClick={onRetry}
        className="ml-auto text-theme-error-600 hover:text-theme-error-700 underline"
      >
        Retry
      </button>
    </div>
  );
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
    upcomingTasks,
    loading,
    error,
    createTask,
    toggleTaskCompletion,
    batchUpdateTasks,
    refetch,
  } = useTasksContext();

  // Filter tasks for display - show all open tasks, including those without due dates
  const openTasksToShow = useMemo(() => {
    // Include all non-completed tasks
    return allTasks.filter(t => !t.completed);
  }, [allTasks]);

  // New task input state
  const [newDailyTask, setNewDailyTask] = useState("");
  const [newOpenTask, setNewOpenTask] = useState("");
  const [newUpcomingTask, setNewUpcomingTask] = useState("");
  const [upcomingTaskDate, setUpcomingTaskDate] = useState("");
  const [isCompletingTask, setIsCompletingTask] = useState<Record<string, boolean>>({});

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

  const handleAddUpcomingTask = async () => {
    if (newUpcomingTask.trim() && upcomingTaskDate) {
      await createTask(newUpcomingTask, upcomingTaskDate);
      setNewUpcomingTask("");
      setUpcomingTaskDate("");
    }
  };

  const handleToggleTaskCompletion = async (taskId: string) => {
    setIsCompletingTask(prev => ({ ...prev, [taskId]: true }));
    try {
      await toggleTaskCompletion(taskId);
    } finally {
      setIsCompletingTask(prev => ({ ...prev, [taskId]: false }));
    }
  };

  // Drag state and handler
  const [isDragging, setIsDragging] = useState(false);

  // Unified drag and drop handler
  function handleDragEnd(result: DropResult) {
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

    // Same list reorder - no API call needed for now
    if (source.droppableId === destination.droppableId && source.index !== destination.index) {
      // not implemented yet
      return;
    }

    // Handle moves to/from hourly planner
    if (source.droppableId === 'dailyTasks' && isHour(destination.droppableId)) {
      // Daily task → Hour slot: Set the hourSlot to schedule the task
      const dstHour = destination.droppableId; // Keep the full "hour-7AM" format
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: dstHour } }
      ]).catch(error => {
        console.error('Failed to update task hourSlot:', error);
      });
      return;
    }

    if ((source.droppableId === 'openTasks' || source.droppableId === 'upcomingTasks') && isHour(destination.droppableId)) {
      // Open/Upcoming task → Hour slot: Set the hourSlot to schedule the task  
      const dstHour = destination.droppableId; // Keep the full "hour-7AM" format
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
        { taskId: draggableId, updates: { hourSlot: null as any } }
      ]).catch(error => {
        console.error('Failed to remove task hourSlot:', error);
      });
      return;
    }

    if (isHour(source.droppableId) && (destination.droppableId === 'openTasks' || destination.droppableId === 'upcomingTasks')) {
      // Hour slot → Open/Upcoming list: Remove hourSlot to unschedule the task
      batchUpdateTasks([
        { taskId: draggableId, updates: { hourSlot: null as any } }
      ]).catch(error => {
        console.error('Failed to remove task hourSlot:', error);
      });
      return;
    }

    if (isHour(source.droppableId) && isHour(destination.droppableId)) {
      // Hour slot → Different hour slot: Update the hourSlot
      const dstHour = destination.droppableId; // Keep the full "hour-7AM" format
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
  const [isHomeProjectsCollapsed, setIsHomeProjectsCollapsed] = useState(false);

  // Mock Home Projects data - in a real implementation, this would come from a context or API
  const mockHomeProjects: HomeProject[] = [
    {
      id: '1',
      title: 'Kitchen Cabinet Repair',
      description: 'Fix the loose hinge on the upper cabinet',
      status: 'active',
      priority: 'high',
      category: 'maintenance',
      room: 'Kitchen',
      dueDate: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '2',
      title: 'Living Room Paint Touch-up',
      description: 'Touch up scuff marks on the living room walls',
      status: 'planning',
      priority: 'medium',
      category: 'improvements',
      room: 'Living Room',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '3',
      title: 'Garage Organization',
      description: 'Organize tools and storage in the garage',
      status: 'active',
      priority: 'low',
      category: 'interior',
      room: 'Garage',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '4',
      title: 'Bathroom Deep Clean',
      description: 'Deep clean and organize the master bathroom',
      status: 'planning',
      priority: 'medium',
      category: 'maintenance',
      room: 'Bathroom',
      dueDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  // Filter active projects (not completed)
  const activeHomeProjects = mockHomeProjects.filter(p => p.status !== 'completed');

  // Function to add project to tasks
  const handleAddProjectToTasks = async (project: HomeProject) => {
    try {
      const taskTitle = `${project.title}${project.room ? ` (${project.room})` : ''}`;
      await createTask(taskTitle, project.dueDate || null);
      // In a real implementation, you might also update the project status
    } catch (error) {
      console.error('Failed to add project to tasks:', error);
    }
  };

  return (
    <aside className="w-[400px] flex-shrink-0 -mt-12">
      <div className="rounded-lg border border-theme-neutral-200 bg-theme-surface-raised p-6 shadow-sm h-full flex flex-col">
        {/* Month header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-theme-text-primary">{format(date, "MMMM yyyy")}</h3>
          <div className="flex gap-1 text-theme-text-tertiary">
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
                  ? "bg-theme-primary-500 text-theme-text-inverse"
                  : "bg-theme-neutral-100 text-theme-text-secondary hover:bg-theme-neutral-200"
              }`}
            >
              <span className="text-lg font-semibold leading-none">{format(day, "d")}</span>
              <span className="text-xs leading-none mt-1">{format(day, "EEE")}</span>
            </button>
          ))}
        </div>

        {/* Toggle Today / Upcoming / Master */}
        <div className="mt-4">
          <div className="flex rounded-full border border-theme-neutral-200 bg-theme-surface-raised p-1 w-full shadow-sm">
            {["Today", "Upcoming", "Master List"].map((tab) => (
              <button
                key={tab}
                onClick={() => setTaskView(tab as any)}
                className={`flex-1 rounded-full px-4 py-1 text-sm font-semibold transition-colors ${
                  taskView === tab
                    ? "bg-theme-primary-500 text-theme-text-inverse shadow"
                    : "text-theme-text-secondary hover:bg-theme-hover hover:text-theme-primary-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Lists */}
        <div className="mt-6 flex-1 overflow-y-auto flex flex-col" style={{ transform: 'none' }}>
          <DragDropContext 
            onDragStart={() => setIsDragging(true)}
            onDragEnd={handleDragEnd}
          >
            {/* Today view */}
            {taskView === "Today" && (
              <>
                {/* Daily tasks header */}
                <Droppable droppableId="dailyTasks">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col">
                      <div
                        className="flex items-center justify-between text-sm font-medium text-theme-text-primary mb-2 cursor-pointer select-none"
                        onClick={() => setIsDailyCollapsed((c) => !c)}
                      >
                        <span>Todoist tasks on {format(selectedDate, "MMM d, yyyy")}</span>
                        {isDailyCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </div>

                      <ul
                        className="space-y-3 text-sm text-theme-text-secondary overflow-y-auto pr-1 transition-[max-height] duration-200"
                        style={{ maxHeight: isDailyCollapsed ? 0 : "10rem" }}
                      >
                        {error ? (
                          <TaskError error={error} onRetry={refetch} />
                        ) : loading && dailyVisibleTasks.length === 0 ? (
                          Array.from({ length: 3 }).map((_, i) => <TaskSkeleton key={i} />)
                        ) : !loading && dailyVisibleTasks.length === 0 ? (
                          <li className="text-theme-text-tertiary text-center py-4">No tasks for today</li>
                        ) : (
                          dailyVisibleTasks.map((t: Task, index: number) => (
                            <Draggable key={t.id} draggableId={t.id.toString()} index={index}>
                              {(prov) => (
                                <li
                                  ref={prov.innerRef}
                                  {...prov.draggableProps}
                                  {...prov.dragHandleProps}
                                  style={prov.draggableProps.style}
                                  className="widget-container flex items-start gap-3 px-4 py-4"
                                >
                                  <input
                                    type="checkbox"
                                    aria-label={t.content}
                                    checked={t.completed ?? false}
                                    disabled={isCompletingTask[t.id.toString()]}
                                    onChange={() => handleToggleTaskCompletion(t.id.toString())}
                                    className={`${t.completed ? "accent-theme-success-600" : "accent-theme-primary-500"} mt-0.5`}
                                  />
                                  <span className={t.completed ? "line-through text-theme-text-quaternary" : "text-theme-text-primary"}>{t.content}</span>
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
                      className="input-field flex-1 text-sm"
                    />
                    <button onClick={handleAddDailyTask} className="text-sm text-theme-primary-600 hover:text-theme-primary-700 hover:underline">
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
                  className="flex items-center justify-between text-sm font-medium text-theme-text-primary mb-2 cursor-pointer select-none"
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
                      className="space-y-3 text-sm text-theme-text-secondary overflow-y-auto pr-1 transition-[max-height] duration-200"
                      style={{ maxHeight: isOpenCollapsed ? 0 : "12rem" }}
                    >
                      {error ? (
                        <TaskError error={error} onRetry={refetch} />
                      ) : loading && upcomingTasks.length === 0 ? (
                        Array.from({ length: 3 }).map((_, i) => <TaskSkeleton key={i} />)
                      ) : !loading && upcomingTasks.length === 0 ? (
                        <li className="text-theme-text-tertiary text-center py-4">No upcoming tasks</li>
                      ) : (
                        upcomingTasks.map((t: Task, index: number) => (
                          <Draggable key={t.id} draggableId={t.id.toString()} index={index}>
                            {(prov) => (
                              <li
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                style={prov.draggableProps.style}
                                className="flex items-start gap-3 px-4 py-4 bg-theme-surface-raised border border-theme-neutral-200 shadow-sm rounded-lg"
                              >
                                <input
                                  type="checkbox"
                                  aria-label={t.content}
                                  checked={t.completed ?? false}
                                  disabled={isCompletingTask[t.id.toString()]}
                                  onChange={() => handleToggleTaskCompletion(t.id.toString())}
                                  className={`${t.completed ? "accent-theme-success-600" : "accent-theme-primary-500"} mt-0.5`}
                                />
                                <div className="flex-1">
                                  <span className={t.completed ? "line-through text-theme-text-quaternary" : "text-theme-text-primary"}>{t.content}</span>
                                  {t.due?.date && (
                                    <div className="text-xs text-theme-text-tertiary mt-1">
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
                      className="input-field w-full text-sm"
                    />
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={upcomingTaskDate}
                        onChange={(e) => setUpcomingTaskDate(e.target.value)}
                        min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                        className="input-field flex-1 text-sm"
                      />
                      <button 
                        onClick={handleAddUpcomingTask}
                        disabled={!newUpcomingTask.trim() || !upcomingTaskDate}
                        className="text-sm text-theme-primary-600 hover:text-theme-primary-700 hover:underline disabled:text-theme-text-quaternary disabled:no-underline"
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
                <div className="flex items-center justify-between text-sm font-medium text-theme-text-primary mb-2">
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
                    className="p-1 hover:bg-theme-hover rounded transition-colors"
                    title="Refresh tasks"
                  >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  </button>
                </div>

                <Droppable droppableId="openTasks">
                  {(provided) => (
                    <ul
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-3 text-sm text-theme-text-secondary overflow-y-auto pr-1 transition-[max-height] duration-200"
                      style={{ maxHeight: isOpenCollapsed ? 0 : "40rem" }}
                    >
                      {error ? (
                        <TaskError error={error} onRetry={refetch} />
                      ) : loading && openTasksToShow.length === 0 ? (
                        Array.from({ length: 3 }).map((_, i) => <TaskSkeleton key={i} />)
                      ) : !loading && openTasksToShow.length === 0 ? (
                        <li className="text-theme-text-tertiary text-center py-4">
                          <div>No open tasks</div>
                          <div className="text-xs mt-1">This shows all active tasks from Todoist</div>
                        </li>
                      ) : (
                        openTasksToShow.map((t: Task, index: number) => (
                          <Draggable key={t.id} draggableId={t.id.toString()} index={index}>
                            {(prov) => (
                              <li
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                style={prov.draggableProps.style}
                                className="flex items-start gap-3 px-4 py-4 bg-theme-surface-raised border border-theme-neutral-200 shadow-sm rounded-lg"
                              >
                                <input
                                  type="checkbox"
                                  aria-label={t.content}
                                  checked={t.completed ?? false}
                                  disabled={isCompletingTask[t.id.toString()]}
                                  onChange={() => handleToggleTaskCompletion(t.id.toString())}
                                  className={`${t.completed ? "accent-theme-success-600" : "accent-theme-primary-500"} mt-0.5`}
                                />
                                <div className="flex-1">
                                  <span className={t.completed ? "line-through text-theme-text-quaternary" : "text-theme-text-primary"}>{t.content}</span>
                                  {t.due?.date && (
                                    <div className="text-xs text-theme-text-tertiary mt-1">
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
                      className="input-field flex-1 text-sm"
                    />
                    <button onClick={handleAddOpenTask} className="text-sm text-theme-primary-600 hover:text-theme-primary-700 hover:underline">
                      Add
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Home Projects Section */}
            {taskView === "Today" && (
              <>
                <div
                  className="flex items-center justify-between text-sm font-medium text-theme-text-primary mt-4 mb-2 cursor-pointer select-none"
                  onClick={() => setIsHomeProjectsCollapsed((c) => !c)}
                >
                  <span>Home Projects ({activeHomeProjects.length})</span>
                  {isHomeProjectsCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </div>
                
                {!isHomeProjectsCollapsed && (
                  <div className="space-y-2 mb-4">
                    {activeHomeProjects.length === 0 ? (
                      <div className="text-sm text-theme-text-secondary p-2 text-center">
                        No active projects
                      </div>
                    ) : (
                      activeHomeProjects.map((project) => {
                        const statusConfig = PROJECT_STATUS[project.status];
                        const priorityColors = {
                          low: 'text-blue-600',
                          medium: 'text-yellow-600', 
                          high: 'text-orange-600',
                          critical: 'text-red-600'
                        };
                        
                        return (
                          <div 
                            key={project.id} 
                            className="flex items-center justify-between p-2 rounded-md border border-theme-neutral-200 bg-theme-surface hover:bg-theme-neutral-50 group"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  statusConfig.color === 'green' ? 'bg-green-500' : 
                                  statusConfig.color === 'blue' ? 'bg-blue-500' : 
                                  statusConfig.color === 'amber' ? 'bg-amber-500' : 
                                  statusConfig.color === 'orange' ? 'bg-orange-500' : 
                                  'bg-gray-500'
                                }`} />
                                <p className="text-sm font-medium text-theme-text-primary truncate">
                                  {project.title}
                                </p>
                                <span className={`text-xs font-medium ${priorityColors[project.priority]}`}>
                                  {project.priority.toUpperCase()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {project.room && (
                                  <span className="text-xs text-theme-text-secondary">
                                    📍 {project.room}
                                  </span>
                                )}
                                {project.dueDate && (
                                  <span className="text-xs text-theme-text-secondary">
                                    📅 {format(new Date(project.dueDate), 'MMM d')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleAddProjectToTasks(project)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-theme-neutral-100 transition-all"
                              title="Add to tasks"
                            >
                              <ListPlus size={14} className="text-theme-text-secondary hover:text-theme-primary-600" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}

            {/* Hourly planner - Unified component */}
            {taskView === "Today" && (
              <>
                <div
                  className="flex items-center justify-between text-sm font-medium text-theme-text-primary mt-4 mb-2 cursor-pointer select-none"
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
      </div>
    </aside>
  );
}
