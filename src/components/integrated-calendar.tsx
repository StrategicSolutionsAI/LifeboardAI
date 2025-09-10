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

  // Allow manual refresh
  const [refreshSeq, setRefreshSeq] = useState(0);

  // Fetch events when anchor month changes or refresh requested
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
  }, [anchorDate, refreshSeq]);

  // Listen for global tasks updates (from chat/task actions) and refresh
  useEffect(() => {
    function onTasksUpdated() {
      setRefreshSeq((s) => s + 1);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('lifeboard:tasks-updated', onTasksUpdated);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('lifeboard:tasks-updated', onTasksUpdated);
      }
    };
  }, []);

  // Display helpers
  const monthMatrix = buildMonthMatrix(anchorDate);
  const weekDays = getWeekDays(anchorDate);

  return (
    <div className={`w-full max-w-none mx-4 bg-white/98 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/70 overflow-hidden`}>
      {/* Enhanced Header */}
      <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200/80 flex-wrap gap-4">
        <div className="flex items-center space-x-3">
          <button 
            onClick={gotoPrev} 
            className="p-2.5 rounded-xl hover:bg-gray-100/80 text-gray-600 hover:text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            aria-label="Previous period"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button 
            onClick={gotoToday} 
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            Today
          </button>
          
          <button 
            onClick={gotoNext} 
            className="p-2.5 rounded-xl hover:bg-gray-100/80 text-gray-600 hover:text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            aria-label="Next period"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          
          <h2 className="ml-4 text-2xl font-bold text-gray-900 tracking-tight whitespace-nowrap">
            {view === "month" && format(anchorDate, "MMMM yyyy")}
            {view === "week" && `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d, yyyy")}`}
            {view === "day" && format(anchorDate, "MMMM d, yyyy")}
          </h2>
        </div>
        
        <div className="flex items-center space-x-4 ml-auto">
          <div className="flex items-center bg-gray-100/80 rounded-xl p-1 border border-gray-200/60">
            {[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }].map((option) => (
              <button
                key={option.value}
                onClick={() => setView(option.value as ViewMode)}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  view === option.value
                    ? 'bg-white shadow-md text-blue-700 border border-blue-200/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshSeq(s => s + 1)}
              className="flex items-center space-x-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-3 py-2 rounded-xl shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 1119 5"/></svg>
              <span>Refresh</span>
            </button>
            <button
              onClick={() => alert("Add event coming soon")}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <Plus size={16} />
              <span>Add event</span>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar body */}
      {view === "month" && (
        <div className="p-6">
          {/* Enhanced Week Days Header */}
          <div className="grid grid-cols-7 bg-gray-50/80 rounded-t-xl border-b border-gray-200/60">
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
              <div key={day} className="px-4 py-3 text-center">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {day.slice(0, 3)}
                </div>
              </div>
            ))}
          </div>
          
          {/* Enhanced Month Grid */}
          <div className="grid grid-cols-7 gap-1 bg-gray-100/50 rounded-b-xl overflow-hidden p-1">
            {monthMatrix.flat().map((day) => {
              const dayStr = day.toISOString().slice(0, 10);
              const dayEvents = eventsByDate[dayStr] ?? [];
              const isCurrentMonth = isSameMonth(day, anchorDate);
              const isToday = isSameDay(day, today);
              
              return (
                <div
                  key={dayStr}
                  onClick={() => dayEvents.length && setSelectedDate(dayStr)}
                  className={`
                    aspect-square cursor-pointer flex flex-col items-start justify-start p-3 
                    transition-all duration-200 transform hover:scale-[1.02] rounded-xl
                    ${
                      isCurrentMonth 
                        ? "bg-white shadow-sm border border-gray-200/60 hover:shadow-md" 
                        : "bg-gray-50/80 text-gray-400 border border-gray-100/50"
                    } 
                    ${
                      isToday 
                        ? "ring-2 ring-blue-500/50 bg-blue-50/80 border-blue-200" 
                        : ""
                    }
                  `}
                >
                  {/* Enhanced Date Header */}
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className={`font-bold text-lg ${
                      isToday ? 'text-blue-700' : 
                      isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                    }`}>
                      {format(day, "d")}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                  
                  {/* Enhanced Event Indicators */}
                  {dayEvents.length > 0 && (
                    <div className="w-full space-y-1">
                      {dayEvents.slice(0, 2).map((ev, i) => {
                        const getEventBarStyle = (source: string) => {
                          switch (source) {
                            case 'google':
                              return 'bg-blue-400 border-blue-500';
                            case 'todoist':
                              return 'bg-purple-400 border-purple-500';
                            default:
                              return 'bg-emerald-400 border-emerald-500';
                          }
                        };
                        
                        return (
                          <div key={i} className={`h-2 rounded-full shadow-sm border ${getEventBarStyle(ev.source)}`} />
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-gray-600 font-semibold bg-gray-200/80 px-2 py-1 rounded-full text-center">
                          +{dayEvents.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="mx-6 mb-6">
          <div className="border border-gray-200/60 rounded-2xl overflow-hidden shadow-lg">
            {/* Enhanced Week Header */}
            <div className="grid grid-cols-7 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
              {weekDays.map((d) => {
                const isToday = isSameDay(d, today);
                return (
                  <div key={d.toISOString()} className={`py-4 text-center border-r border-gray-200/60 last:border-r-0 ${
                    isToday ? 'bg-blue-50/80 border-blue-200/60' : ''
                  }`}>
                    <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      {format(d, "EEE")}
                    </div>
                    <div className={`text-xl font-bold mt-1 ${
                      isToday ? 'text-blue-700' : 'text-gray-900'
                    }`}>
                      {format(d, "d")}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Enhanced Week Content */}
            <div className="grid grid-cols-7 gap-6 p-6 bg-gray-50/30 h-[650px]">
              {weekDays.map((d) => {
                const dateStr = d.toISOString().slice(0, 10);
                const dayEvents = eventsByDate[dateStr] ?? [];
                const isToday = isSameDay(d, today);
                
                return (
                  <div key={dateStr} className={`h-full bg-white rounded-xl p-4 shadow-sm border border-gray-200/60 flex flex-col ${
                    isToday ? 'ring-2 ring-blue-500/30 bg-blue-50/20' : ''
                  }`}>
                    <div className="space-y-2">
                      {dayEvents.map((ev, i) => {
                        const getEventStyle = (source: string) => {
                          switch (source) {
                            case 'google':
                              return {
                                container: 'bg-blue-100/80 border border-blue-200 text-blue-800',
                                time: 'text-blue-600'
                              };
                            case 'todoist':
                              return {
                                container: 'bg-purple-100/80 border border-purple-200 text-purple-800',
                                time: 'text-purple-600'
                              };
                            default:
                              return {
                                container: 'bg-emerald-100/80 border border-emerald-200 text-emerald-800',
                                time: 'text-emerald-600'
                              };
                          }
                        };
                        
                        const styles = getEventStyle(ev.source);
                        const timeDisplay = ev.time ? format(new Date(ev.time), 'h:mm a') : '';
                        
                        return (
                          <div
                            key={i}
                            className={`p-2 rounded-lg text-xs border-l-3 hover:shadow-sm transition-all duration-200 ${styles.container}`}
                          >
                            {timeDisplay && (
                              <div className={`font-bold mb-1 ${styles.time}`}>
                                {timeDisplay}
                              </div>
                            )}
                            <div className="font-medium line-clamp-2">
                              {ev.title}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {view === "day" && (
        <div className="mx-6 mb-6">
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200/80">
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                {format(anchorDate, "EEEE, MMMM d, yyyy")}
              </h3>
              <p className="text-sm text-gray-600 mt-2 font-medium">
                Plan your day with precision scheduling
              </p>
            </div>
            
            <div className="p-6">
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
                <HourlyPlanner className="max-h-[75vh] overflow-y-auto rounded-xl" isDragging={isDragging} />
              </DragDropContext>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Modal for event details */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {format(new Date(selectedDate), "MMMM d, yyyy")}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {format(new Date(selectedDate), "EEEE")}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {(eventsByDate[selectedDate] ?? []).map((ev, idx) => {
                  const getEventStyle = (source: string) => {
                    switch (source) {
                      case 'google':
                        return {
                          container: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
                          dot: 'bg-blue-500',
                          badge: 'bg-blue-100 text-blue-700 border-blue-200'
                        };
                      case 'todoist':
                        return {
                          container: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
                          dot: 'bg-purple-500',
                          badge: 'bg-purple-100 text-purple-700 border-purple-200'
                        };
                      default:
                        return {
                          container: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
                          dot: 'bg-emerald-500',
                          badge: 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        };
                    }
                  };
                  
                  const getSourceLabel = (source: string) => {
                    switch (source) {
                      case 'google':
                        return 'Google Calendar';
                      case 'todoist':
                        return 'Todoist';
                      default:
                        return source;
                    }
                  };
                  
                  const styles = getEventStyle(ev.source);
                  
                  return (
                    <div key={idx} className={`p-4 rounded-xl border transition-all duration-200 ${styles.container}`}>
                      <div className="flex items-start space-x-3">
                        <div className={`w-3 h-3 rounded-full mt-1 ring-2 ring-white shadow-sm ${styles.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 mb-2">{ev.title}</p>
                          <div className="flex items-center flex-wrap gap-2">
                            <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${styles.badge}`}>
                              {getSourceLabel(ev.source)}
                            </span>
                            {ev.time && (
                              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                                {ev.allDay ? "All day" : format(new Date(ev.time), "h:mm a")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(eventsByDate[selectedDate]?.length ?? 0) === 0 && (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-500 font-medium">No events scheduled</p>
                    <p className="text-xs text-gray-400 mt-1">This day is completely free</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
