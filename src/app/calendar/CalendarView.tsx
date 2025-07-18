"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { TasksProvider } from "@/contexts/tasks-context";

// Load calendar grid on client to avoid SSR issues with date-fns
const FullCalendar = dynamic(() => import("@/components/full-calendar"), { ssr: false });

export default function CalendarView() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <TasksProvider selectedDate={selectedDate}>
      <div className="w-full">
        <FullCalendar 
          selectedDate={selectedDate} 
          onDateChange={setSelectedDate} 
        />
      </div>
    </TasksProvider>
  );
}
