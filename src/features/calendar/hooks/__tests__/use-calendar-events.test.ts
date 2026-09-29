import { renderHook } from "@testing-library/react";
import { useCalendarEvents } from "../use-calendar-events";
import type { Task } from "@/types/tasks";

// A zone with daylight saving, so a span across the spring change is 23h short.
process.env.TZ = "America/Chicago";

jest.mock("@/hooks/use-data-cache", () => ({
  useDataCache: () => ({ data: [], loading: false, error: null }),
}));
jest.mock("@/lib/fetch-with-timeout", () => ({ fetchWithTimeout: jest.fn() }));

const weeklyFromJanuary: Task = {
  id: "bins",
  content: "Put out the bins",
  completed: false,
  due: { date: "2026-01-05" }, // a Monday in standard time
  startDate: "2026-01-05",
  endDate: "2026-01-05",
  repeatRule: "weekly",
  allDay: true,
  source: "supabase",
};

describe("useCalendarEvents", () => {
  it("shows a weekly task on the first day of a view range after the spring DST change", () => {
    const { result } = renderHook(() =>
      useCalendarEvents({
        currentDate: new Date(2026, 8, 28), // Monday Sep 28 — the range starts on the task's weekday
        view: "day",
        selectedBucketFilters: ["all"],
        uploadRefreshIndex: 0,
        allTasks: [weeklyFromJanuary],
        getTaskForOccurrence: (task) => task,
      }),
    );
    const titles = (result.current.eventsByDate["2026-09-28"] ?? []).map((e) => e.title);
    expect(titles).toContain("Put out the bins");
  });
});
