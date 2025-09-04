"use client";

import { useEffect, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { Plus } from "lucide-react";
import HourlyPlanner from "@/components/hourly-planner";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useTasksContext } from "@/contexts/tasks-context";

interface DayEvent {
  source: "google" | "todoist";
  title: string;
  time?: string;
  allDay?: boolean;
}

type ViewMode = "month" | "week" | "day";

function buildMonthMatrix(current: Date) {
  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const rows: Date[][] = [];
  let day = startDate;
  while (day <= endDate) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    rows.push(week);
  }
  return rows;
}

function getWeekDays(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export default function IntegratedCalendar() {
  const { batchUpdateTasks } = useTasksContext();
  const [isDragging, setIsDragging] = useState(false);
  const [view, setView] = useState<ViewMode>("month");
  const [anchorDate, setAnchorDate] = useState<Date>(startOfDay(new Date()));
  const [eventsByDate, setEventsByDate] = useState<Record<string, DayEvent[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const today = startOfDay(new Date());

  // Navigation helpers
  const gotoToday = () => setAnchorDate(startOfDay(new Date()));
  const gotoPrev = () => {
    setAnchorDate((d) => {
      if (view === "month") return subMonths(d, 1);
      if (view === "week") return subDays(d, 7);
      return subDays(d, 1);
    });
  };
  const gotoNext = () => {
    setAnchorDate((d) => {
      if (view === "month") return addMonths(d, 1);
      if (view === "week") return addDays(d, 7);
      return addDays(d, 1);
    });
  };

  // Fetch events when anchor month changes
  useEffect(() => {
    async function fetchEvents() {
      const monthStart = startOfMonth(anchorDate);
      const monthEnd = endOfMonth(anchorDate);
      const timeMin = monthStart.toISOString();
      const timeMax = monthEnd.toISOString();

      const map: Record<string, DayEvent[]> = {};

      // Google Calendar events
      try {
        const resp = await fetch(
          `/api/integrations/google/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=2500`
        );
        if (resp.ok) {
          const data = await resp.json();
          (data.events ?? []).forEach((ev: any) => {
            const dateStr =
              ev.start?.date ??
              (ev.start?.dateTime ? ev.start.dateTime.slice(0, 10) : null);
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = [];
            map[dateStr].push({
              source: "google",
              title: ev.summary ?? "Event",
              time: ev.start?.dateTime ?? undefined,
              allDay: !!ev.start?.date,
            });
          });
        }
      } catch (err) {
        console.error("Failed to fetch Google events", err);
      }

      // Todoist tasks
      try {
        const resp = await fetch("/api/integrations/todoist/tasks?all=true");
        if (resp.ok) {
          const data = await resp.json();
          const tasks: any[] = Array.isArray(data) ? data : data.tasks ?? [];
          tasks.forEach((t: any) => {
            const dateStr: string | undefined = t.due?.date;
            if (!dateStr) return;
            if (dateStr >= timeMin.slice(0, 10) && dateStr <= timeMax.slice(0, 10)) {
              if (!map[dateStr]) map[dateStr] = [];
              map[dateStr].push({
                source: "todoist",
                title: t.content ?? "Task",
                time: t.due?.datetime ?? undefined,
              });
            }
          });
        }
      } catch (err) {
        console.error("Failed to fetch Todoist tasks", err);
      }

      setEventsByDate(map);
    }

    fetchEvents();
  }, [anchorDate]);

  // Display helpers
  const monthMatrix = buildMonthMatrix(anchorDate);
  const weekDays = getWeekDays(anchorDate);

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <button onClick={gotoPrev} className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600">
            &lt;
          </button>
          <button onClick={gotoToday} className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600">
            Today
          </button>
          <button onClick={gotoNext} className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600">
            &gt;
          </button>
          <h2 className="ml-4 text-lg font-semibold text-gray-800 whitespace-nowrap">
            {view === "month" && format(anchorDate, "MMMM yyyy")}
            {view === "week" && `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d, yyyy")}`}
            {view === "day" && format(anchorDate, "MMMM d, yyyy")}
          </h2>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={view}
            onChange={(e) => setView(e.target.value as ViewMode)}
            className="border rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="month">Month view</option>
            <option value="week">Week view</option>
            <option value="day">Day view</option>
          </select>
          <button
            onClick={() => alert("Add event coming soon")}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded"
          >
            <Plus size={16} /> Add event
          </button>
        </div>
      </div>

      {/* Calendar body */}
      {view === "month" && (
        <>
          <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-md overflow-hidden">
            {monthMatrix.flat().map((day) => {
              const dayStr = day.toISOString().slice(0, 10);
              const dayEvents = eventsByDate[dayStr] ?? [];
              const isCurrentMonth = isSameMonth(day, anchorDate);
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={dayStr}
                  onClick={() => dayEvents.length && setSelectedDate(dayStr)}
                  className={`aspect-square cursor-pointer flex flex-col items-center justify-start text-sm ${
                    isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400"
                  } ${
                    isToday ? "bg-theme-primary-500 text-white border-2 border-theme-primary-600" : ""
                  }`}
                >
                  <span className="mt-1">{format(day, "d")}</span>
                  {dayEvents.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                      {dayEvents.slice(0, 3).map((_, i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === "week" && (
        <div className="border rounded-md overflow-hidden">
          <div className="grid grid-cols-7 text-center text-xs text-gray-500 bg-gray-50 border-b">
            {weekDays.map((d) => (
              <div key={d.toISOString()} className="py-2">
                <div className="font-medium text-gray-700">{format(d, "EEE")}</div>
                <div className="text-gray-900">{format(d, "d")}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {weekDays.map((d) => {
              const dateStr = d.toISOString().slice(0, 10);
              const dayEvents = eventsByDate[dateStr] ?? [];
              return (
                <div key={dateStr} className="min-h-[120px] bg-white p-1 overflow-auto">
                  {dayEvents.map((ev, i) => (
                    <div
                      key={i}
                      className="mb-1 px-1 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 truncate"
                    >
                      {ev.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "day" && (
        <div className="border rounded-md p-4">
          <h3 className="text-base font-medium mb-4">
            {format(anchorDate, "EEEE, MMMM d, yyyy")}
          </h3>
          {/* Hourly planner */}
          <DragDropContext
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(result: DropResult) => {
              // Ignore drops if a resize operation is active
              if (typeof document !== 'undefined' && document.body.classList.contains('lb-resizing')) {
                setIsDragging(false);
                return;
              }
              setIsDragging(false);
              if (!result.destination) return;
              const { source, destination, draggableId } = result;
              const isHour = (id: string) => id.startsWith('hour-');

              // Only handle hour → hour moves in this simple integrated view
              if (isHour(source.droppableId) && isHour(destination.droppableId)) {
                const dstHour = destination.droppableId; // keep full 'hour-7AM'
                batchUpdateTasks([{ taskId: draggableId, updates: { hourSlot: dstHour } }])
                  .catch(err => console.error('Failed to update task hourSlot:', err));
              }
            }}
          >
            <HourlyPlanner className="max-h-[70vh] overflow-y-auto" isDragging={isDragging} />
          </DragDropContext>
        </div>
      )}

      {/* Modal for month/day selection */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg w-96 max-w-[90%] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">
                {format(new Date(selectedDate), "MMMM d, yyyy")}
              </h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-gray-400 hover:text-gray-600 rounded-md focus:outline-none"
              >
                &times;
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-auto">
              {(eventsByDate[selectedDate] ?? []).map((ev, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="mt-1 w-2 h-2 rounded-full bg-indigo-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{ev.title}</p>
                    {ev.time && (
                      <p className="text-xs text-gray-500">
                        {ev.allDay ? "All day" : format(new Date(ev.time), "h:mm a")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {(eventsByDate[selectedDate]?.length ?? 0) === 0 && (
                <p className="text-sm text-gray-500">No events</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
