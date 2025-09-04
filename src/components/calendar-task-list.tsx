"use client";

import React, { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { ChevronRight, ChevronDown, ChevronLeft } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useTasksContext } from "@/contexts/tasks-context";

interface CalendarTaskListProps {
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
  availableBuckets?: string[];
  selectedBucket?: string;
  isDragging?: boolean;
  disableInternalDragDrop?: boolean;
}

export function CalendarTaskList({ selectedDate, onDateChange, availableBuckets = [], selectedBucket, isDragging = false, disableInternalDragDrop = false }: CalendarTaskListProps) {
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

  // Today-only list (always use real today, independent of selectedDate)
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const todayTasks = useMemo(() =>
    allTasks.filter(t => !t.completed && !t.hourSlot && t.due?.date === todayStr),
    [allTasks, todayStr]
  );

  // Open tasks (only shown in Master List tab)
  const openTasksToShow = useMemo(() => 
    allTasks.filter(t => !t.completed && !t.hourSlot), 
    [allTasks]
  );

  // New task input state
  const [newDailyTask, setNewDailyTask] = useState("");
  const [newOpenTask, setNewOpenTask] = useState("");
  const [taskBucket, setTaskBucket] = useState(selectedBucket || (availableBuckets.length > 0 ? availableBuckets[0] : ''));

  const handleAddDailyTask = async () => {
    if (newDailyTask.trim()) {
      // Always add to today in this sidebar's Today section
      await createTask(newDailyTask, todayStr, undefined, taskBucket);
      setNewDailyTask("");
    }
  };

  const handleAddOpenTask = async () => {
    if (newOpenTask.trim()) {
      await createTask(newOpenTask, null, undefined, taskBucket);
      setNewOpenTask("");
    }
  };

  // Unified drag and drop handler
  function handleDragEnd(result: DropResult) {
    // Ignore drops if a resize operation is active in the planner
    if (typeof document !== 'undefined' && document.body.classList.contains('lb-resizing')) {
      return;
    }
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
      // Open task → Today list: Set due date to real today
      batchUpdateTasks([
        { taskId: draggableId, updates: { due: { date: todayStr } } }
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
        <div className="flex rounded-full border border-theme-neutral-200 bg-theme-surface-raised p-1 w-full shadow-sm">
          {(['Today','Upcoming','Master List'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTaskView(tab)}
              className={`flex-1 rounded-full px-4 py-1 text-sm font-semibold transition-colors ${
                taskView === tab
                  ? 'bg-theme-primary-500 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-theme-primary-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Task lists with drag & drop */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!disableInternalDragDrop ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            {renderTaskContent()}
          </DragDropContext>
        ) : (
          renderTaskContent()
        )}
      </div>
    </div>
  );

  function renderTaskContent() {
    return (
      <>
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
                    <span>Tasks for Today</span>
                    {isDailyCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </div>

                  <ul
                    className="space-y-2 text-sm text-gray-700 pr-1 transition-[max-height] duration-200 overflow-y-auto"
                    style={{ maxHeight: isDailyCollapsed ? 0 : '12rem' }}
                  >
                    {loading && todayTasks.length === 0 ? (
                      <li className="text-gray-500">Loading…</li>
                    ) : null}

                    {!loading && todayTasks.length === 0 ? (
                      <li className="text-gray-500">No tasks for today</li>
                    ) : null}

                    {todayTasks.map((t: any, index: number) => (
                      <Draggable draggableId={t.id.toString()} index={index} key={t.id}>
                        {(provided: any) => (
                          <li
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={provided.draggableProps.style}
                            className="flex items-start gap-2 px-3 py-3 bg-card border border-border/60 shadow-sm hover:shadow-md rounded-xl transition-all duration-200 cursor-grab active:cursor-grabbing"
                          >
                            <input
                              type="checkbox"
                              aria-label={t.content}
                              checked={t.completed ?? false}
                              onChange={() => toggleTaskCompletion(t.id.toString())}
                              className={`${t.completed ? 'accent-purple-600' : 'accent-indigo-500'} mt-0.5`}
                            />
                            <div className="flex-1">
                              <span className={t.completed ? 'line-through text-gray-400' : ''}>{t.content}</span>
                              {t.bucket && (
                                <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                                  {t.bucket}
                                </span>
                              )}
                            </div>
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
              <div className="mt-2 space-y-2">
                {availableBuckets.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 font-medium">Bucket:</label>
                    <select
                      value={taskBucket}
                      onChange={(e) => setTaskBucket(e.target.value)}
                      className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                    >
                      {availableBuckets.map(bucket => (
                        <option key={bucket} value={bucket}>{bucket}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-2">
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
              </div>
            )}
          </>
        )}

        {/* Master List tab: show open tasks only in this tab */}
        {taskView === 'Master List' && (
        <div className={`mt-4`}>
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
               style={{ maxHeight: isOpenCollapsed ? 0 : '60vh' }}
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
                            className="group relative flex items-start gap-2 px-3 py-3 bg-card border border-border/60 shadow-sm hover:shadow-md rounded-xl transition-all duration-200"
                          >
                            <input
                              type="checkbox"
                              aria-label={t.content}
                              checked={t.completed ?? false}
                              onChange={() => toggleTaskCompletion(t.id.toString())}
                              className={`${t.completed ? 'accent-purple-600' : 'accent-indigo-500'} mt-0.5`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`truncate ${t.completed ? 'line-through text-gray-400' : ''}`}>{t.content}</span>
                                {t.bucket && (
                                  <span className="shrink-0 inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                                    {t.bucket}
                                  </span>
                                )}
                              </div>
                              {/* Hover bucket selector: appears on hover without changing layout height */}
                              {availableBuckets?.length > 0 && (
                                <select
                                  aria-label="Change bucket"
                                  title="Change bucket"
                                  value={t.bucket || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    batchUpdateTasks([
                                      { taskId: t.id.toString(), updates: { bucket: val ? val : null } }
                                    ]).catch(err => console.error('Failed to update bucket', err));
                                  }}
                                  className="absolute right-3 top-2 text-xs rounded-md border border-gray-300 px-2 py-0.5 bg-white focus:border-indigo-500 focus:outline-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
                                >
                                  <option value="">No bucket</option>
                                  {availableBuckets.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                  ))}
                                </select>
                              )}
                            </div>
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
            <div className="mt-2 space-y-2">
              {availableBuckets.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 font-medium">Bucket:</label>
                  <select
                    value={taskBucket}
                    onChange={(e) => setTaskBucket(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    {availableBuckets.map(bucket => (
                      <option key={bucket} value={bucket}>{bucket}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
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
            </div>
          )}
        </div>
        )}
      </>
    );
  }
}
