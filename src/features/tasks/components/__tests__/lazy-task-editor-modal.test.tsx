import React, { createRef } from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import LazyTaskEditorModal from "@/features/tasks/components/lazy-task-editor-modal";
import type { TaskEditorModalHandle } from "@/features/tasks/components/task-editor-modal";
import type { Task } from "@/types/tasks";

const mockDeleteTask = jest.fn();
const mockCreateTask = jest.fn();
const mockBatchUpdateTasks = jest.fn();

jest.mock("@/contexts/tasks-context", () => ({
  useTaskData: () => ({ allTasks: [] }),
  useTaskActions: () => ({
    createTask: mockCreateTask,
    batchUpdateTasks: mockBatchUpdateTasks,
    deleteTask: mockDeleteTask,
  }),
}));

jest.mock("@/hooks/use-visual-viewport", () => ({
  useVisualViewport: () => 1000,
}));

jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/components/ui/emoji-picker-button", () => ({
  EmojiPickerButton: () => <button type="button">Add emoji</button>,
}));

jest.mock("@/lib/user-preferences", () => ({
  invalidateAllPreferencesCaches: jest.fn(),
}));

jest.mock("@/lib/pin-to-dashboard", () => ({
  findPinnedWidget: jest.fn().mockResolvedValue(null),
  togglePinToDashboard: jest.fn(),
}));

/**
 * The editor is loaded lazily to keep ~22 kB off the first load of /tasks and
 * /calendar. Because callers drive it imperatively through a ref, the risk of
 * deferring it is that an open() issued before the chunk resolves is dropped.
 * These tests pin the queue-and-replay behaviour that prevents that.
 */
describe("LazyTaskEditorModal", () => {
  const task: Task = {
    id: "task-1",
    content: "Recurring task",
    completed: false,
    due: { date: "2026-04-01", is_recurring: true },
    startDate: "2026-04-01",
    endDate: "2026-04-01",
    repeatRule: "daily",
    allDay: true,
    source: "supabase",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
      text: async () => "",
    }) as unknown as typeof fetch;
  });

  it("renders nothing until something asks it to open", () => {
    const ref = createRef<TaskEditorModalHandle>();
    const { container } = render(
      <LazyTaskEditorModal ref={ref} availableBuckets={["Work"]} />
    );
    expect(container).toBeEmptyDOMElement();
    // The handle is still available to callers even before the chunk loads.
    expect(ref.current).not.toBeNull();
  });

  it("replays an open() issued before the chunk finished loading", async () => {
    const ref = createRef<TaskEditorModalHandle>();
    render(<LazyTaskEditorModal ref={ref} availableBuckets={["Work"]} />);

    // Fire immediately — at this point the real modal has not loaded at all.
    act(() => {
      ref.current?.openWithTask(task, "2026-04-10");
    });

    // Once the chunk resolves, the queued call must have been applied, so the
    // editor is open and populated rather than mounted-but-closed.
    await waitFor(() => {
      expect(screen.getByDisplayValue("Recurring task")).toBeInTheDocument();
    });
  });

  it("supports openNew() through the same deferred path", async () => {
    const ref = createRef<TaskEditorModalHandle>();
    render(<LazyTaskEditorModal ref={ref} availableBuckets={["Work"]} />);

    act(() => {
      ref.current?.openNew("2026-04-10");
    });

    await waitFor(() => {
      // A brand-new task opens with an empty content field (and no delete
      // button, since there is nothing to delete yet).
      expect(
        screen.getByPlaceholderText("What needs to be done?")
      ).toHaveValue("");
    });
  });

  it("close() before load is a no-op rather than a crash", () => {
    const ref = createRef<TaskEditorModalHandle>();
    render(<LazyTaskEditorModal ref={ref} availableBuckets={["Work"]} />);
    expect(() => act(() => ref.current?.close())).not.toThrow();
  });
});
