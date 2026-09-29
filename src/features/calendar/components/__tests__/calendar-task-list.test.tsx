import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DragDropContext } from "@hello-pangea/dnd";
import { CalendarTaskList } from "@/features/calendar/components/calendar-task-list";
import type { Task, TaskOccurrenceException } from "@/types/tasks";

process.env.TZ = "America/Chicago";

const mockToggleTaskCompletion = jest.fn();
const mockBatchUpdateTasks = jest.fn();
const mockSetOccurrenceDone = jest.fn();
let mockTasks: Task[] = [];
let mockExceptions = new Map<string, Map<string, TaskOccurrenceException>>();

jest.mock("@/contexts/tasks-context", () => ({
  useTaskData: () => ({ allTasks: mockTasks, upcomingTasks: [], occurrenceExceptionIndex: mockExceptions, loading: false }),
  useTaskActions: () => ({
    createTask: jest.fn(),
    toggleTaskCompletion: mockToggleTaskCompletion,
    batchUpdateTasks: mockBatchUpdateTasks,
    setOccurrenceDone: mockSetOccurrenceDone,
  }),
}));
jest.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/lib/user-preferences", () => ({ getUserPreferencesClient: jest.fn().mockResolvedValue({}) }));
jest.mock("@/features/calendar/components/habit-checklist-panel", () => ({ HabitChecklistPanel: () => null }));

const TODAY = "2026-09-28"; // a Monday, after the spring DST change
const task = (over: Partial<Task>): Task => ({ id: over.content ?? "t", content: "t", completed: false, source: "supabase", ...over }) as Task;
const due = (date: string) => ({ due: { date }, startDate: date, endDate: date });

function renderMasterList(selectedDate: Date) {
  render(
    <DragDropContext onDragEnd={() => {}}>
      <CalendarTaskList selectedDate={selectedDate} />
    </DragDropContext>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Master List" }));
}

describe("CalendarTaskList day list", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 28, 10, 0));
    jest.clearAllMocks();
    mockBatchUpdateTasks.mockResolvedValue(undefined);
    mockExceptions = new Map();
  });
  afterEach(() => jest.useRealTimers());

  it("uses the Today tab's rules: DST-safe repeats, skipped days hidden, one occurrence finished", async () => {
    const bins = task({ content: "Bins", ...due("2026-01-05"), repeatRule: "weekly" });
    const deleted = task({ content: "Skipped today", ...due("2026-09-01"), repeatRule: "daily" });
    mockExceptions = new Map([[deleted.id, new Map([[TODAY, { id: "x", taskId: deleted.id, occurrenceDate: TODAY, skip: true }]])]]);
    mockTasks = [bins, deleted];
    renderMasterList(new Date(2026, 8, 28));

    expect(screen.getByText("Today's Tasks")).toBeInTheDocument();
    expect(screen.getByText("Bins")).toBeInTheDocument();
    // A skipped occurrence counts as finished for the day, not as open.
    expect(screen.getByRole("button", { name: /Completed · 1/ })).toBeInTheDocument();

    const binsRow = screen.getByText("Bins").closest("div.group") as HTMLElement;
    await act(async () => { fireEvent.click(binsRow.querySelector('input[type="checkbox"]')!); });
    expect(mockSetOccurrenceDone).toHaveBeenCalledWith(bins, TODAY, true);
    expect(mockToggleTaskCompletion).not.toHaveBeenCalled();
  });

  it("offers to move carried-over work only when viewing today", async () => {
    mockTasks = [task({ content: "Late", ...due("2026-09-20") })];
    renderMasterList(new Date(2026, 8, 28));
    expect(screen.getByText("1 carried over from earlier days")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Move all to today" })); });
    expect(mockBatchUpdateTasks).toHaveBeenCalledWith([{ taskId: "Late", updates: { due: { date: TODAY }, startDate: TODAY } }]);
  });

  it("titles another day by its date and carries nothing into it", () => {
    mockTasks = [
      task({ content: "Late", ...due("2026-09-20") }),
      task({ content: "Party", ...due("2026-10-02") }),
    ];
    renderMasterList(new Date(2026, 9, 2));
    expect(screen.getByText("Fri, Oct 2")).toBeInTheDocument();
    expect(screen.getByText("Party")).toBeInTheDocument();
    expect(screen.queryByText(/carried over/)).not.toBeInTheDocument();
  });
});
