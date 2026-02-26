import { CalendarHeaderSkeleton, CalendarMonthSkeleton, TaskListSkeleton } from "@/components/calendar-loading-skeleton"

export default function LoadingCalendar() {
  return (
    <div className="h-full">
      <CalendarHeaderSkeleton />
      <div className="flex gap-6 p-4">
        <div className="flex-1">
          <CalendarMonthSkeleton />
        </div>
        <div className="hidden lg:block w-[360px]">
          <TaskListSkeleton />
        </div>
      </div>
    </div>
  )
}
