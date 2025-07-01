"use client";

import { useState, useEffect } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
  addDays,
  format,
  parseISO,
} from "date-fns";

function buildMonthMatrix(currentMonth: Date) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const rows: Date[][] = [];
  let day = startDate;
  let formattedDate = "";
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

interface DayEvent { source: 'google' | 'todoist'; title: string; time?: string; allDay?: boolean; }

export default function FullCalendar() {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [eventsByDate, setEventsByDate] = useState<Record<string, DayEvent[]>>({});
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const nextMonth = () => setCurrentMonth((m) => addMonths(m, 1));
  const prevMonth = () => setCurrentMonth((m) => subMonths(m, 1));

  const rows = buildMonthMatrix(currentMonth);

  // Fetch Google Calendar events and Todoist tasks whenever month changes
  useEffect(() => {
    async function fetchEvents() {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const timeMin = monthStart.toISOString();
      const timeMax = monthEnd.toISOString();

      const map: Record<string, DayEvent[]> = {};

      // ---------------- Google Calendar ----------------
      try {
        const resp = await fetch(`/api/integrations/google/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=2500`);
        if (resp.ok) {
          const data = await resp.json();
          (data.events ?? []).forEach((ev: any) => {
            const dateStr = ev.start?.date ?? (ev.start?.dateTime ? ev.start.dateTime.slice(0,10) : null);
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = [];
            map[dateStr].push({ source: 'google', title: ev.summary ?? 'Event', time: ev.start?.dateTime ?? undefined, allDay: !!ev.start?.date });
          });
        }
      } catch (err) {
        console.error('Failed to fetch Google events', err);
      }

      // ---------------- Todoist Tasks ----------------
      try {
        const resp = await fetch('/api/integrations/todoist/tasks?all=true');
        if (resp.ok) {
          const data = await resp.json();
          const tasks: any[] = Array.isArray(data) ? data : (data.tasks ?? []);
          tasks.forEach((t: any) => {
            const dateStr: string | undefined = t.due?.date;
            if (!dateStr) return;
            // Only include tasks within this month
            if (dateStr >= timeMin.slice(0,10) && dateStr <= timeMax.slice(0,10)) {
              if (!map[dateStr]) map[dateStr] = [];
              map[dateStr].push({ source: 'todoist', title: t.content ?? 'Task', time: t.due?.datetime ?? undefined });
            }
          });
        }
      } catch (err) {
        console.error('Failed to fetch Todoist tasks', err);
      }

      setEventsByDate(map);
    }

    fetchEvents();
  }, [currentMonth]);

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600"
        >
          &lt;
        </button>
        <h2 className="text-lg font-semibold text-gray-800">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button
          onClick={nextMonth}
          className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600"
        >
          &gt;
        </button>
      </div>

      {/* Week Days */}
      <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-md overflow-hidden">
        {rows.flat().map((day: Date, idx: number) => {
          const dayStr = day.toISOString().slice(0,10);
          const dayEvents = eventsByDate[dayStr] ?? [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, today);
          return (
            <div
              key={idx}
              onClick={() => dayEvents.length && setSelectedDate(dayStr)}
              className={`aspect-square cursor-pointer flex flex-col items-center justify-start text-sm  ${
                isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400"
              } ${isToday ? "border border-indigo-500" : ""}`}
            >
              <span className="mt-1">{format(day, "d")}</span>
              {dayEvents.length > 0 && (
                <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                  {dayEvents.slice(0,3).map((ev: DayEvent, i: number)=>(
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${ev.source==='google' ? 'bg-blue-500' : 'bg-indigo-500'}`}></span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg w-96 max-w-[90%] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">{format(parseISO(selectedDate), 'MMMM d, yyyy')}</h3>
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
                  <span className={`mt-1 w-2 h-2 rounded-full ${ev.source === 'google' ? 'bg-blue-500' : 'bg-indigo-500'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{ev.title}</p>
                    {ev.time && (
                      <p className="text-xs text-gray-500">
                        {ev.allDay ? 'All day' : format(new Date(ev.time), 'h:mm a')}
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
