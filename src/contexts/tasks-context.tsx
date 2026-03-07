"use client";

import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { TasksOccurrencePromptProvider } from "./tasks-occurrence-prompt-context";
import type { Task, TaskOccurrenceException } from "@/types/tasks";

interface TasksProviderProps {
  children: ReactNode;
  selectedDate?: Date;
}

// ── Data context (changes when task data changes) ──────────────────────
export interface TaskDataContextValue {
  dailyTasks: Task[];
  allTasks: Task[];
  dailyVisibleTasks: Task[];
  scheduledTasks: Task[];
  upcomingTasks: Task[];
  completedTasks: Task[];
  loading: boolean;
  error: Error | null;
}

export const TaskDataContext = createContext<TaskDataContextValue | null>(null);

// ── Actions context (stable refs, never triggers re-renders) ───────────
export interface TaskActionsContextValue {
  createTask: ReturnType<typeof useTasks>["createTask"];
  toggleTaskCompletion: ReturnType<typeof useTasks>["toggleTaskCompletion"];
  batchUpdateTasks: ReturnType<typeof useTasks>["batchUpdateTasks"];
  deleteTask: ReturnType<typeof useTasks>["deleteTask"];
  refetch: () => void;
  getTaskForOccurrence: ReturnType<typeof useTasks>["getTaskForOccurrence"];
}

export const TaskActionsContext = createContext<TaskActionsContextValue | null>(null);

// ── Legacy combined context (for backward compat during migration) ─────
export const TasksContext = createContext<ReturnType<typeof useTasks> | null>(null);

function TasksProviderInner({ children, selectedDate }: TasksProviderProps) {
  const tasks = useTasks(selectedDate);

  // Stabilize actions via refs so the actions context value never changes
  const actionsRef = useRef<TaskActionsContextValue>(null!);
  actionsRef.current = {
    createTask: tasks.createTask,
    toggleTaskCompletion: tasks.toggleTaskCompletion,
    batchUpdateTasks: tasks.batchUpdateTasks,
    deleteTask: tasks.deleteTask,
    refetch: tasks.refetch,
    getTaskForOccurrence: tasks.getTaskForOccurrence,
  };

  // Stable actions object created once — delegates to ref for latest impl
  const stableActions = useMemo<TaskActionsContextValue>(() => ({
    createTask: (...args: Parameters<typeof tasks.createTask>) => actionsRef.current.createTask(...args),
    toggleTaskCompletion: (...args: Parameters<typeof tasks.toggleTaskCompletion>) => actionsRef.current.toggleTaskCompletion(...args),
    batchUpdateTasks: (...args: Parameters<typeof tasks.batchUpdateTasks>) => actionsRef.current.batchUpdateTasks(...args),
    deleteTask: (...args: Parameters<typeof tasks.deleteTask>) => actionsRef.current.deleteTask(...args),
    refetch: () => actionsRef.current.refetch(),
    getTaskForOccurrence: (...args: Parameters<typeof tasks.getTaskForOccurrence>) => actionsRef.current.getTaskForOccurrence(...args),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const dataValue = useMemo<TaskDataContextValue>(() => ({
    dailyTasks: tasks.dailyTasks,
    allTasks: tasks.allTasks,
    dailyVisibleTasks: tasks.dailyVisibleTasks,
    scheduledTasks: tasks.scheduledTasks,
    upcomingTasks: tasks.upcomingTasks,
    completedTasks: tasks.completedTasks,
    loading: tasks.loading,
    error: tasks.error,
  }), [
    tasks.dailyTasks,
    tasks.allTasks,
    tasks.dailyVisibleTasks,
    tasks.scheduledTasks,
    tasks.upcomingTasks,
    tasks.completedTasks,
    tasks.loading,
    tasks.error,
  ]);

  return (
    <TasksContext.Provider value={tasks}>
      <TaskActionsContext.Provider value={stableActions}>
        <TaskDataContext.Provider value={dataValue}>
          {children}
        </TaskDataContext.Provider>
      </TaskActionsContext.Provider>
    </TasksContext.Provider>
  );
}

export function TasksProvider({ children, selectedDate }: TasksProviderProps) {
  return (
    <TasksOccurrencePromptProvider>
      <TasksProviderInner selectedDate={selectedDate}>{children}</TasksProviderInner>
    </TasksOccurrencePromptProvider>
  );
}

// ── Hooks ──────────────────────────────────────────────────────────────

/** @deprecated Use useTaskData() and/or useTaskActions() for better performance */
export function useTasksContext() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasksContext must be used within TasksProvider");
  return ctx;
}

/** Only re-renders when task data changes. Use for components that display tasks. */
export function useTaskData() {
  const ctx = useContext(TaskDataContext);
  if (!ctx) throw new Error("useTaskData must be used within TasksProvider");
  return ctx;
}

/** Never triggers re-renders. Use for components that only mutate tasks. */
export function useTaskActions() {
  const ctx = useContext(TaskActionsContext);
  if (!ctx) throw new Error("useTaskActions must be used within TasksProvider");
  return ctx;
}
