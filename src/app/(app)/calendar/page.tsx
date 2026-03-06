import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarHeaderSkeleton, CalendarMonthSkeleton, TaskListSkeleton } from "@/features/calendar/components/calendar-loading-skeleton";

export const metadata: Metadata = {
  title: "Calendar | LifeboardAI",
};

const CalendarView = dynamic(
  () => import("./OptimizedCalendarView"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full">
        <CalendarHeaderSkeleton />
        <div className="flex flex-col lg:flex-row gap-6 p-4">
          <div className="flex-1">
            <CalendarMonthSkeleton />
          </div>
          <div className="hidden lg:block lg:w-[360px]">
            <TaskListSkeleton />
          </div>
        </div>
      </div>
    )
  }
);

import SectionLoadTimer from "@/components/section-load-timer";

export default function CalendarPage() {
  return (
    <>
      <SectionLoadTimer name="/calendar" />
      <Suspense fallback={
        <div className="h-full">
          <CalendarHeaderSkeleton />
          <div className="flex flex-col lg:flex-row gap-6 p-4">
            <div className="flex-1">
              <CalendarMonthSkeleton />
            </div>
            <div className="hidden lg:block lg:w-[360px]">
              <TaskListSkeleton />
            </div>
          </div>
        </div>
      }>
        <CalendarView />
      </Suspense>
    </>
  );
}
