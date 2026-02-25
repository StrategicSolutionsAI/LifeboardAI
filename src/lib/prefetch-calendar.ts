"use client";

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
};

const SLOW_CONNECTIONS = new Set(["slow-2g", "2g"]);

let calendarAssetsPrefetched = false;

export function shouldPrefetchCalendar() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const connection = (navigator as NavigatorWithConnection).connection;
  if (!connection) {
    return true;
  }

  if (connection.saveData) {
    return false;
  }

  return !SLOW_CONNECTIONS.has((connection.effectiveType ?? "").toLowerCase());
}

export async function prefetchCalendarExperience() {
  if (calendarAssetsPrefetched) {
    return;
  }

  calendarAssetsPrefetched = true;

  await Promise.allSettled([
    import("@/app/calendar/OptimizedCalendarView"),
    import("@/components/full-calendar"),
    import("@/components/calendar-task-list"),
  ]);
}
