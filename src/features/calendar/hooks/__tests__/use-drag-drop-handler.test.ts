jest.mock("@/features/calendar/types", () => ({
  toDayKey: jest.fn(),
  hourSlotToISO: jest.fn(),
}));

import { hourSlotToISO, toDayKey } from "@/features/calendar/types";
import { buildCalendarDayMovePlan, resolveHabitDropPayload } from "@/features/calendar/hooks/use-drag-drop-handler";

const mockedToDayKey = toDayKey as jest.Mock;
const mockedHourSlotToISO = hourSlotToISO as jest.Mock;

beforeEach(() => {
  mockedToDayKey.mockImplementation((date: Date) => date.toISOString().slice(0, 10));
  mockedHourSlotToISO.mockImplementation((hourSlot: string | null | undefined, dateStr: string) =>
    hourSlot ? `${dateStr}T14:00:00.000Z` : undefined,
  );
});

describe("resolveHabitDropPayload", () => {
  const draggableId = `habit::widget-123::${encodeURIComponent("Health")}`;
  const selectedDateStr = "2026-03-24";

  it("creates an all-day drop payload for calendar day cells", () => {
    expect(
      resolveHabitDropPayload(draggableId, "calendar-day-2026-03-28", selectedDateStr),
    ).toEqual({
      instanceId: "widget-123",
      bucketName: "Health",
      targetDate: "2026-03-28",
      allDay: true,
    });
  });

  it("creates an all-day drop payload for the day-view all-day strip", () => {
    expect(
      resolveHabitDropPayload(draggableId, "allday-strip", selectedDateStr),
    ).toEqual({
      instanceId: "widget-123",
      bucketName: "Health",
      targetDate: "2026-03-24",
      allDay: true,
    });
  });

  it("creates a timed drop payload for hourly planner slots", () => {
    expect(
      resolveHabitDropPayload(draggableId, "hour-2:30PM", selectedDateStr),
    ).toEqual({
      instanceId: "widget-123",
      bucketName: "Health",
      targetDate: "2026-03-24",
      hourSlot: "hour-2:30PM",
      allDay: false,
    });
  });

  it("returns null for unsupported drop zones", () => {
    expect(
      resolveHabitDropPayload(draggableId, "hourly-planner-drop", selectedDateStr),
    ).toBeNull();
  });
});

describe("buildCalendarDayMovePlan", () => {
  it("moves a single-day task to the destination date", () => {
    expect(
      buildCalendarDayMovePlan(
        "task-123",
        {
          content: "Doctor appointment",
          hourSlot: "hour-2PM",
          duration: 60,
          repeatRule: undefined,
          startDate: "2026-03-24",
          endDate: "2026-03-24",
        },
        "2026-03-24",
        "2026-03-28",
      ),
    ).toEqual({
      updates: {
        due: { date: "2026-03-28" },
        hourSlot: "hour-2PM",
        startDate: "2026-03-28",
        endDate: "2026-03-28",
      },
      detail: {
        taskId: "task-123",
        fromDate: "2026-03-24",
        toDate: "2026-03-28",
        title: "Doctor appointment",
        time: "2026-03-28T14:00:00.000Z",
        hourSlot: "hour-2PM",
        allDay: false,
        duration: 60,
        repeatRule: null,
      },
      requiresSeriesConfirmation: false,
    });
  });

  it("shifts multi-day spans by the same day delta", () => {
    expect(
      buildCalendarDayMovePlan(
        "task-456",
        {
          content: "Trip",
          hourSlot: null,
          repeatRule: undefined,
          startDate: "2026-03-24",
          endDate: "2026-03-26",
        },
        "2026-03-24",
        "2026-03-28",
      ),
    ).toMatchObject({
      updates: {
        due: { date: "2026-03-28" },
        hourSlot: null,
        startDate: "2026-03-28",
        endDate: "2026-03-30",
      },
      detail: {
        taskId: "task-456",
        fromDate: "2026-03-24",
        toDate: "2026-03-28",
        allDay: true,
      },
    });
  });

  it("marks repeating task moves as series-level only", () => {
    expect(
      buildCalendarDayMovePlan(
        "task-789",
        {
          content: "Standup",
          hourSlot: "hour-9AM",
          repeatRule: "weekly",
          startDate: "2026-03-24",
          endDate: "2026-03-24",
        },
        "2026-03-24",
        "2026-03-31",
      ).requiresSeriesConfirmation,
    ).toBe(true);
  });
});
