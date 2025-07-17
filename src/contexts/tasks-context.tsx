"use client";

import { createContext, useContext } from "react";
import { useTasks } from "@/hooks/use-tasks";

interface TasksProviderProps {
  children: React.ReactNode;
  selectedDate?: Date;
}

export const TasksContext = createContext<ReturnType<typeof useTasks> | null>(
  null,
);

export function TasksProvider({ children, selectedDate }: TasksProviderProps) {
  const tasks = useTasks(selectedDate);
  return <TasksContext.Provider value={tasks}>{children}</TasksContext.Provider>;
}

export function useTasksContext() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasksContext must be used within TasksProvider");
  return ctx;
}
