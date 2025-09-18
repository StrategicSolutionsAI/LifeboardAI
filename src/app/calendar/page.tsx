import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarHeaderSkeleton, CalendarMonthSkeleton, TaskListSkeleton } from "@/components/calendar-loading-skeleton";

export const metadata: Metadata = {
  title: "Calendar | LifeboardAI",
};

// Use optimized calendar by default, with fallback to original via query param
const CalendarView = dynamic(
  () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('optimized') === 'false') {
        return import("./CalendarView");
      }
    }
    return import("./OptimizedCalendarView");
  },
  { 
    ssr: false,
    loading: () => (
      <div className="h-full">
        <CalendarHeaderSkeleton />
        <div className="flex gap-6 p-4">
          <div className="flex-1">
            <CalendarMonthSkeleton />
          </div>
          <div className="w-[360px]">
            <TaskListSkeleton />
          </div>
        </div>
      </div>
    )
  }
);

import { SidebarLayout } from "@/components/sidebar-layout";
import SectionLoadTimer from "@/components/section-load-timer";

export default function CalendarPage() {
  return (
    <SidebarLayout>
      <SectionLoadTimer name="/calendar" />
      <Suspense fallback={
        <div className="h-full">
          <CalendarHeaderSkeleton />
          <div className="flex gap-6 p-4">
            <div className="flex-1">
              <CalendarMonthSkeleton />
            </div>
            <div className="w-[360px]">
              <TaskListSkeleton />
            </div>
          </div>
        </div>
      }>
        <CalendarView />
      </Suspense>
    </SidebarLayout>
  );
}
