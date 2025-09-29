"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { TasksOccurrencePromptProvider } from "./tasks-occurrence-prompt-context";

interface TasksProviderProps {
  children: ReactNode;
  selectedDate?: Date;
}

export const TasksContext = createContext<ReturnType<typeof useTasks> | null>(
  null,
);

function TasksProviderInner({ children, selectedDate }: TasksProviderProps) {
  const tasks = useTasks(selectedDate);
  return <TasksContext.Provider value={tasks}>{children}</TasksContext.Provider>;
}

export function TasksProvider({ children, selectedDate }: TasksProviderProps) {
  return (
    <TasksOccurrencePromptProvider>
      <TasksProviderInner selectedDate={selectedDate}>{children}</TasksProviderInner>
    </TasksOccurrencePromptProvider>
  );
}

export function useTasksContext() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasksContext must be used within TasksProvider");
  return ctx;
}
