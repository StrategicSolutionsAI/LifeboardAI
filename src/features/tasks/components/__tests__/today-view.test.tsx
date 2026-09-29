import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { TodayView } from "@/features/tasks/components/today-view";
import type { Task } from "@/types/tasks";

const mockCreateTask = jest.fn();
const mockBatchUpdateTasks = jest.fn();
const mockSetOccurrenceDone = jest.fn();
const mockToast = jest.fn();

jest.mock("@/contexts/tasks-context", () => ({
  useTaskData: () => ({ occurrenceExceptionIndex: new Map() }),
  useTaskActions: () => ({
    createTask: mockCreateTask,
    batchUpdateTasks: mockBatchUpdateTasks,
    setOccurrenceDone: mockSetOccurrenceDone,
  }),
}));

jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const TODAY = "2026-09-28";
const task = (over: Partial<Task>): Task => ({ id: over.content ?? "t", content: "t", completed: false, ...over }) as Task;
const due = (date: string) => ({ due: { date }, startDate: date, endDate: date });

function renderView(tasks: Task[], onToggleTask = jest.fn().mockResolvedValue(undefined)) {
  render(
    <TodayView
      tasks={tasks}
      buckets={["Home", "Family"]}
      bucketColors={{}}
      familyMembers={[]}
      onToggleTask={onToggleTask}
      onEditTask={jest.fn()}
    />,
  );
  return { onToggleTask };
}

describe("TodayView", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 28, 10, 0));
    jest.clearAllMocks();
    mockCreateTask.mockResolvedValue(undefined);
    mockBatchUpdateTasks.mockResolvedValue(undefined);
    mockSetOccurrenceDone.mockResolvedValue(undefined);
  });
  afterEach(() => jest.useRealTimers());

  it("completes a one-off task after the row settles", async () => {
    const { onToggleTask } = renderView([task({ content: "Laundry", ...due(TODAY) })]);
    fireEvent.click(screen.getByRole("checkbox", { name: 'Complete "Laundry"' }));
    // Checked in place first…
    expect(screen.getByRole("checkbox", { name: 'Mark "Laundry" not done' })).toBeInTheDocument();
    expect(onToggleTask).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(onToggleTask).toHaveBeenCalledWith("Laundry");
  });

  it("finishes only today's occurrence of a repeating task, never the series", async () => {
    const vitamins = task({ content: "Vitamins", ...due("2026-09-01"), repeatRule: "daily" });
    const { onToggleTask } = renderView([vitamins]);
    fireEvent.click(screen.getByRole("checkbox", { name: 'Complete "Vitamins"' }));
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(mockSetOccurrenceDone).toHaveBeenCalledWith(vitamins, TODAY, true);
    expect(onToggleTask).not.toHaveBeenCalled();
  });

  it("closes a Todoist repeat through Todoist, which advances it, not as a local occurrence", async () => {
    const standup = task({ content: "Standup", ...due(TODAY), repeatRule: "daily", source: "todoist" });
    const { onToggleTask } = renderView([standup]);
    fireEvent.click(screen.getByRole("checkbox", { name: 'Complete "Standup"' }));
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(onToggleTask).toHaveBeenCalledWith("Standup");
    expect(mockSetOccurrenceDone).not.toHaveBeenCalled();
  });

  it("sends Someday as a cleared date the Todoist route understands", async () => {
    renderView([task({ content: "Old", ...due("2026-09-20") })]);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Someday" })); });
    expect(mockBatchUpdateTasks).toHaveBeenCalledWith([{ taskId: "Old", updates: { due: null, startDate: null } }]);
  });

  it("ignores a half-typed year in the reschedule date field", async () => {
    renderView([task({ content: "Old", ...due("2026-09-20") })]);
    fireEvent.click(screen.getByRole("button", { name: "Reschedule Old" }));
    const field = screen.getByLabelText("Pick a date");
    fireEvent.change(field, { target: { value: "0002-10-05" } });
    expect(mockBatchUpdateTasks).not.toHaveBeenCalled();
    await act(async () => { fireEvent.change(field, { target: { value: "2026-10-05" } }); });
    expect(mockBatchUpdateTasks).toHaveBeenCalledWith([{ taskId: "Old", updates: { due: { date: "2026-10-05" }, startDate: "2026-10-05" } }]);
  });

  it("moves every carried-over task to today in one batch, with undo", async () => {
    renderView([
      task({ content: "Old", ...due("2026-09-20") }),
      task({ content: "Older", ...due("2026-09-01") }),
    ]);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Move all to today" })); });
    expect(mockBatchUpdateTasks).toHaveBeenCalledWith([
      { taskId: "Older", updates: { due: { date: TODAY }, startDate: TODAY } },
      { taskId: "Old", updates: { due: { date: TODAY }, startDate: TODAY } },
    ]);
    const toast = mockToast.mock.calls[0][0];
    expect(toast.title).toBe("2 tasks moved to Today");
    await act(async () => { toast.undoAction(); });
    expect(mockBatchUpdateTasks).toHaveBeenLastCalledWith([
      { taskId: "Older", updates: { due: { date: "2026-09-01" }, startDate: "2026-09-01" } },
      { taskId: "Old", updates: { due: { date: "2026-09-20" }, startDate: "2026-09-20" } },
    ]);
  });

  it("keeps a long carried-over pile from burying today's plan", () => {
    renderView(["a", "b", "c", "d", "e"].map((c, i) => task({ content: c, ...due(`2026-09-0${i + 1}`) })));
    const carried = screen.getByRole("region", { name: "Carried over" });
    expect(carried.querySelectorAll("li")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Show all 5" }));
    expect(carried.querySelectorAll("li")).toHaveLength(5);
  });

  it("quick-adds with parsed date, time, length and bucket, and says where it went", async () => {
    renderView([]);
    const input = screen.getByRole("textbox", { name: "Add a task for today" });
    fireEvent.change(input, { target: { value: "Call mom tomorrow 3pm for 30m #home" } });
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    await act(async () => { fireEvent.submit(input.closest("form")!); });
    expect(mockCreateTask).toHaveBeenCalledWith("Call mom", "2026-09-29", "hour-3PM", "Home", "none", { duration: 30, assigneeId: null });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Added to Tomorrow" }));
  });

  it("quick-adds to today when no date is typed", async () => {
    renderView([]);
    const input = screen.getByRole("textbox", { name: "Add a task for today" });
    fireEvent.change(input, { target: { value: "Water plants" } });
    await act(async () => { fireEvent.submit(input.closest("form")!); });
    expect(mockCreateTask).toHaveBeenCalledWith("Water plants", TODAY, null, undefined, "none", { duration: null, assigneeId: null });
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("pulls a suggestion into today with one click", async () => {
    renderView([task({ content: "Paint walls", ...due("2026-09-29") })]);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: 'Add "Paint walls" to today' })); });
    expect(mockBatchUpdateTasks).toHaveBeenCalledWith([
      { taskId: "Paint walls", updates: { due: { date: TODAY }, startDate: TODAY } },
    ]);
  });

  it("groups timed tasks by part of day and marks the one happening now", () => {
    renderView([
      task({ content: "Standup", ...due(TODAY), hourSlot: "hour-9:30AM" }),
      task({ content: "Pickup", ...due(TODAY), hourSlot: "hour-3PM" }),
    ]);
    expect(screen.getByRole("heading", { name: /Morning/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Afternoon/ })).toBeInTheDocument();
    expect(screen.getByText("Now")).toBeInTheDocument();
  });
});
