import React, { createRef } from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import TaskEditorModal, { type TaskEditorModalHandle } from "@/features/tasks/components/task-editor-modal";
import type { Task } from "@/types/tasks";

const mockDeleteTask = jest.fn();
const mockCreateTask = jest.fn();
const mockBatchUpdateTasks = jest.fn();
const mockToast = jest.fn();

jest.mock("@/contexts/tasks-context", () => ({
  useTaskData: () => ({
    allTasks: [],
  }),
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
  useToast: () => ({
    toast: mockToast,
  }),
}));

jest.mock("@/components/ui/emoji-picker-button", () => ({
  EmojiPickerButton: ({ onEmojiSelect }: { onEmojiSelect: (emoji: string) => void }) => (
    <button type="button" onClick={() => onEmojiSelect("🙂")}>
      Add emoji
    </button>
  ),
}));

jest.mock("@/lib/user-preferences", () => ({
  invalidateAllPreferencesCaches: jest.fn(),
}));

jest.mock("@/lib/pin-to-dashboard", () => ({
  findPinnedWidget: jest.fn().mockResolvedValue(null),
  togglePinToDashboard: jest.fn(),
}));

describe("TaskEditorModal", () => {
  const recurringTask: Task = {
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

  it("passes the selected calendar occurrence date into deleteTask", async () => {
    mockDeleteTask.mockResolvedValue(undefined);

    const ref = createRef<TaskEditorModalHandle>();

    render(<TaskEditorModal ref={ref} availableBuckets={["Work"]} />);

    act(() => {
      ref.current?.openWithTask(recurringTask, "2026-04-10");
    });

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, delete/i }));

    await waitFor(() => {
      expect(mockDeleteTask).toHaveBeenCalledWith("task-1", "2026-04-10");
    });
  });
});
