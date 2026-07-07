"use client";

let calendarAssetsPrefetched = false;


export async function prefetchCalendarExperience() {
  if (calendarAssetsPrefetched) {
    return;
  }

  calendarAssetsPrefetched = true;

  await Promise.allSettled([
    import("@/app/(app)/calendar/OptimizedCalendarView"),
    import("@/features/calendar/components/full-calendar"),
    import("@/features/calendar/components/calendar-task-list"),
  ]);
}
