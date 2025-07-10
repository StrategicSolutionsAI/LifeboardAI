"use client";

// Reusable sidebar component shared between Dashboard and Calendar pages
// -------------------------------------------------------------------
// This file is essentially a self-contained copy of the sidebar logic that
// originally lived inside taskboard-dashboard.tsx.  Until we have a more
// sophisticated shared state layer, duplicating the logic here is the most
// pragmatic way to unblock reuse on the Calendar page without refactoring the
// entire dashboard.  Once things stabilise we can DRY it up further.

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { format, addDays, isSameDay } from "date-fns";
import {
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { supabase } from "@/utils/supabase/client";

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export function TaskSidePanel() {
  /**
   * Basic calendar / date state
   */
  const [date, setDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const selectedDateStr = `${selectedDate.getFullYear()}-${String(
    selectedDate.getMonth() + 1
  ).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

  function handleDateChange(newDate: Date) {
    const d = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
    setDate(d);
    setSelectedDate(d);
  }

  // Utility: the 7-day window centred on `date` (Mon-Sun style)
  const getWeekDays = () => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay()); // move to Sunday
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  /**
   * Todoist task fetching / state
   */
  const [todoistTasks, setTodoistTasks] = useState<any[]>([]);
  const [allTodoistTasks, setAllTodoistTasks] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingAllTasks, setIsLoadingAllTasks] = useState(false);

  async function fetchDailyTasks() {
    setIsLoadingTasks(true);
    try {
      const iso = selectedDate.toISOString().split("T")[0];
      const res = await fetch(`/api/integrations/todoist/tasks?date=${iso}`);
      if (res.ok) {
        const data = await res.json();
        const tasks: any[] = Array.isArray(data) ? data : (data.tasks ?? []);
        setTodoistTasks(tasks);
      }
    } finally {
      setIsLoadingTasks(false);
    }
  }

  async function fetchAllOpenTasks() {
    setIsLoadingAllTasks(true);
    try {
      const res = await fetch(`/api/integrations/todoist/tasks?all=true`);
      if (res.ok) {
        const data = await res.json();
        const tasks: any[] = Array.isArray(data) ? data : (data.tasks ?? []);
        setAllTodoistTasks(tasks);
      }
    } finally {
      setIsLoadingAllTasks(false);
    }
  }

  // Load tasks on mount + whenever the selected date changes
  useEffect(() => {
    fetchDailyTasks();
  }, [selectedDate]);

  useEffect(() => {
    fetchAllOpenTasks();
  }, []);

  /**
   * Derived subsets used in the UI
   */
  const dailyVisibleTasks = useMemo(() => (Array.isArray(todoistTasks) ? todoistTasks.filter((t) => !t.completed) : []), [todoistTasks]);
  const openTasksToShow = useMemo(() => (Array.isArray(allTodoistTasks) ? allTodoistTasks.filter((t) => !t.completed) : []), [allTodoistTasks]);

  /**
   * New-task input helpers
   */
  const [newDailyTask, setNewDailyTask] = useState("");
  const [newOpenTask, setNewOpenTask] = useState("");

  async function createTask(content: string, dueDate: string | null) {
    const trimmed = content.trim();
    if (!trimmed) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic: any = {
      id: tempId,
      content: trimmed,
      completed: false,
      due: dueDate ? { date: dueDate } : null,
    };

    setAllTodoistTasks((prev) => [optimistic, ...prev]);
    if (dueDate) setTodoistTasks((prev) => [optimistic, ...prev]);

    try {
      const res = await fetch("/api/integrations/todoist/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, dueDate }),
      });
      if (res.ok) {
        const real = await res.json();
        setAllTodoistTasks((prev) => prev.map((t) => (t.id === tempId ? real : t)));
        setTodoistTasks((prev) => prev.map((t) => (t.id === tempId ? real : t)));
      }
    } catch {
      // Roll back on failure
      setAllTodoistTasks((prev) => prev.filter((t) => t.id !== tempId));
      setTodoistTasks((prev) => prev.filter((t) => t.id !== tempId));
    }
  }

  const handleAddDailyTask = () => {
    createTask(newDailyTask, selectedDateStr);
    setNewDailyTask("");
  };
  const handleAddOpenTask = () => {
    createTask(newOpenTask, null);
    setNewOpenTask("");
  };

  /**
   * Task completion toggle (optimistic)
   */
  async function toggleTaskCompletion(taskId: string) {
    const isCompleted = allTodoistTasks.find((t) => t.id.toString() === taskId)?.completed ?? false;
    const newVal = !isCompleted;

    const update = (arr: any[]) =>
      arr.map((t) => (t.id.toString() === taskId ? { ...t, completed: newVal } : t));

    setAllTodoistTasks((prev) => update(prev));
    setTodoistTasks((prev) => update(prev));

    const endpoint = newVal ? "/api/integrations/todoist/tasks/complete" : "/api/integrations/todoist/tasks/reopen";
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
    } catch {
      // best-effort; leave UI as-is on error
    }
  }

  /**
   * Drag-and-drop between lists and hourly planner
   */
  const HOUR_HEIGHT = 48;
  const hours = useMemo(() => Array.from({ length: 15 }, (_, i) => {
    const h = 7 + i;
    return `${h % 12 || 12}${h < 12 ? "AM" : "PM"}`;
  }), []);

  const [hourlyPlan, setHourlyPlan] = useState<Record<string, any[]>>(() => {
    const obj: Record<string, any[]> = {};
    hours.forEach((h) => (obj[h] = []));
    return obj;
  });

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
    const task = hourlyPlan[hour].find((t) => t.id.toString() === taskId);
    const startDuration = task?.duration ?? 60;
    resizeStartRef.current = { y: startY, duration: startDuration, taskId, hour };
    setResizingTask({ taskId, hour });

    function onMove(ev: MouseEvent) {
      if (!resizeStartRef.current) return;
      const delta = ev.clientY - resizeStartRef.current.y;
      const minutes = Math.max(15, Math.round((resizeStartRef.current.duration + (delta / HOUR_HEIGHT) * 60) / 15) * 15);
      setHourlyPlan((prev) => {
        const copy = { ...prev };
        copy[hour] = copy[hour].map((t) =>
          t.id.toString() === taskId ? { ...t, duration: minutes } : t
        );
        return copy;
      });
    }

    async function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setResizingTask(null);

      if (resizeStartRef.current) {
        const { taskId: id, hour: hr } = resizeStartRef.current;
        const task = hourlyPlan[hr].find((t) => t.id.toString() === id);
        if (task) {
          await fetch("/api/integrations/todoist/tasks/update-duration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: id, duration: task.duration ?? 60 }),
          });
        }
      }
      resizeStartRef.current = null;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // Simple case: same list reorder
    if (source.droppableId === destination.droppableId) {
      if (source.index === destination.index) return;
      if (source.droppableId === "dailyTasks") {
        setTodoistTasks((prev) => {
          const copy = [...prev];
          const [moved] = copy.splice(source.index, 1);
          copy.splice(destination.index, 0, moved);
          return copy;
        });
      } else if (source.droppableId === "openTasks") {
        setAllTodoistTasks((prev) => {
          const copy = [...prev];
          const [moved] = copy.splice(source.index, 1);
          copy.splice(destination.index, 0, moved);
          return copy;
        });
      }
      return;
    }

    // Planner ↔ lists moves and list-to-list transfers elided for brevity
    // ------------------------------------------------------------------
    // For now we only support reordering within a single list in this
    // shared component.  Dashboard keeps its full fidelity behaviour.
  }

  /** UI collapse controls */
  const [taskView, setTaskView] = useState<"Today" | "Upcoming" | "Master List">("Today");
  const [isDailyCollapsed, setIsDailyCollapsed] = useState(false);
  const [isOpenCollapsed, setIsOpenCollapsed] = useState(false);
  const [isPlannerCollapsed, setIsPlannerCollapsed] = useState(false);

  // Current time indicator for hourly planner
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const currentHourDisplay = useMemo(() => {
    const h = currentTime.getHours();
    return `${h % 12 || 12}${h < 12 ? "AM" : "PM"}`;
  }, [currentTime]);

  // -----------------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------------
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
          {getWeekDays().map((day, idx) => (
            <button
              key={idx}
              onClick={() => handleDateChange(day)}
              className={`flex flex-col items-center rounded-xl px-3 py-2 w-14 transition-colors ${
                isSameDay(day, selectedDate)
                  ? "bg-gradient-to-r from-[#7482FE] to-[#909CFF] text-white"
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
                    ? "bg-gradient-to-r from-[#7482FE] to-[#909CFF] text-white shadow"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Lists */}
        <div className="mt-6 flex-1 overflow-hidden flex flex-col">
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
                        {isLoadingTasks && dailyVisibleTasks.length === 0 && <li className="text-gray-500">Loading…</li>}
                        {!isLoadingTasks && dailyVisibleTasks.length === 0 && <li className="text-gray-500">No tasks</li>}

                        {dailyVisibleTasks.map((t: any, index: number) => (
                          <Draggable key={t.id} draggableId={t.id.toString()} index={index} isDragDisabled={!!resizingTask}>
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

            {/* Upcoming & Master List share the open-tasks list */}
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
                      {isLoadingAllTasks && openTasksToShow.length === 0 && <li className="text-gray-500">Loading…</li>}
                      {!isLoadingAllTasks && openTasksToShow.length === 0 && <li className="text-gray-500">No tasks</li>}

                      {openTasksToShow.map((t: any, index: number) => (
                        <Draggable key={t.id} draggableId={t.id.toString()} index={index} isDragDisabled={!!resizingTask}>
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
              </>
            )}

            {/* Hourly planner (7 AM → 9 PM) */}
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
                  className="space-y-2 overflow-y-auto pr-1 transition-[max-height] duration-200"
                  style={{ maxHeight: isPlannerCollapsed ? 0 : "16rem" }}
                >
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
                            {hourlyPlan[disp].map((t: any, index: number) => (
                              <Draggable key={t.id} draggableId={t.id.toString()} index={index} isDragDisabled={!!resizingTask}>
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
                                    className="relative flex items-start gap-2.5 px-3.5 py-3 bg-white border border-black/10 shadow-sm rounded-lg"
                                  >
                                    <div className="flex items-start gap-2.5 w-full h-full min-h-[36px]">
                                      <div className="flex-shrink-0 mt-1.5">
                                        <div className="w-2 h-2 bg-[#8A96FF] rounded-full" />
                                      </div>
                                      <div className="flex flex-col w-full justify-center min-w-0">
                                        {(() => {
                                          // Calculate start time from the hour slot
                                          const startHour12 = parseInt(disp.replace(/[^0-9]/g, '')) || 12;
                                          const isPM = disp.includes("PM");
                                          
                                          // Calculate end time from duration
                                          const dur = t.duration ?? 60;
                                          const start24 = (startHour12 % 12) + (isPM ? 12 : 0);
                                          const endTotal = start24 * 60 + dur;
                                          const end24 = Math.floor(endTotal / 60);
                                          const endMin = endTotal % 60;
                                          const endHour12 = end24 > 12 ? end24 - 12 : (end24 === 0 ? 12 : end24);
                                          const endIsPM = end24 >= 12;
                                          
                                          // Format time range appropriately
                                          const startTime = `${startHour12}:00 ${isPM ? 'PM' : 'AM'}`;
                                          const endTime = `${endHour12}:${endMin.toString().padStart(2, '0')} ${endIsPM ? 'PM' : 'AM'}`;
                                          const timeRange = `${startTime} - ${endTime}`;
                                          
                                          // For very short tasks under 20 minutes, only show content if there's room
                                          const showContent = dur >= 20;
                                          
                                          return (
                                            <>
                                              <div className="text-xs text-gray-500 leading-tight mb-0.5">{timeRange}</div>
                                              {showContent && (
                                                <div className="font-semibold truncate">
                                                  {t.content}
                                                </div>
                                              )}
                                            </>
                                          );
                                        })()} 
                                      </div>
                                    </div>
                                    <div
                                      onMouseDown={(e) => startResize(e, disp, t.id.toString())}
                                      className="absolute -bottom-1 left-0 right-0 h-2 cursor-ns-resize bg-purple-200 hover:bg-purple-300 rounded-b-md"
                                    />
                                  </li>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </ul>

                          {/* current time indicator */}
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
              </>
            )}
          </DragDropContext>
        </div>
      </div>
    </aside>
  );
}
