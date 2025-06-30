"use client";

import { useState } from "react";
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

export default function FullCalendar() {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const today = new Date();

  const nextMonth = () => setCurrentMonth((m) => addMonths(m, 1));
  const prevMonth = () => setCurrentMonth((m) => subMonths(m, 1));

  const rows = buildMonthMatrix(currentMonth);

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
        {rows.flat().map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, today);
          return (
            <div
              key={idx}
              className={`aspect-square flex items-center justify-center text-sm  ${
                isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400"
              } ${isToday ? "border border-indigo-500" : ""}`}
            >
              {format(day, "d")}
            </div>
          );
        })}
      </div>
    </div>
  );
}
