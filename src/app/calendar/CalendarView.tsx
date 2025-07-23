"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { TasksProvider } from "@/contexts/tasks-context";
import { CalendarTaskList } from "@/components/calendar-task-list";

// Load calendar grid on client to avoid SSR issues with date-fns
const FullCalendar = dynamic(() => import("@/components/full-calendar"), { ssr: false });

export default function CalendarView() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleDateChange = (newDate: Date) => {
    console.log('📅 Calendar date changed:', newDate);
    setSelectedDate(newDate);
  };

  return (
    <TasksProvider selectedDate={selectedDate}>
      <div className="flex gap-6 h-full">
        {/* Main calendar area */}
        <div className="flex-1 min-w-0">
          <FullCalendar 
            selectedDate={selectedDate} 
            onDateChange={handleDateChange} 
          />
        </div>
        
        {/* Task list sidebar */}
        <div className="flex-shrink-0">
          <CalendarTaskList 
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          />
        </div>
      </div>
    </TasksProvider>
  );
}
