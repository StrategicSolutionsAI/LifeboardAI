import { useRef } from 'react'
import { format } from 'date-fns'
import { useOccurrencePrompt } from '@/contexts/tasks-occurrence-prompt-context'
import { getTodoistConnected, setTodoistConnected as setModuleTodoistConnected } from './task-helpers'
import type { TaskSharedState } from './task-helpers'
import { useTaskOccurrenceExceptions } from './use-task-occurrence-exceptions'
import { useTaskFetcher } from './use-task-fetcher'
import { useTaskMutations } from './use-task-mutations'
import { useTaskViews } from './use-task-views'
import type { Task } from '@/types/tasks'

// Types re-exported for backward compatibility
export type { RepeatRule, RepeatOption, KanbanStatus, TaskDue, Task, TaskOccurrenceException } from '@/types/tasks'

export function useTasks(selectedDate?: Date) {
  const dateStr = format(selectedDate ?? new Date(), 'yyyy-MM-dd')

  // ── Shared mutable state (passed to sub-hooks) ──────────────────────
  const todoistConnectedRef = useRef<boolean | null>(getTodoistConnected())
  const setTodoistConnected = (v: boolean | null) => {
    setModuleTodoistConnected(v)
    todoistConnectedRef.current = v
  }
  const sharedFetchRef = useRef<Promise<Task[]> | null>(null)
  const sharedResultRef = useRef<{ data: Task[]; ts: number } | null>(null)
  const localUpdateTimestamps = useRef<Set<number>>(new Set())
  const nocacheRef = useRef(false)

  const shared: TaskSharedState = {
    sharedFetchRef,
    sharedResultRef,
    todoistConnectedRef,
    setTodoistConnected,
    localUpdateTimestamps,
    nocacheRef,
  }

  // ── Compose sub-hooks ───────────────────────────────────────────────
  const promptOccurrenceDecision = useOccurrencePrompt()

  const occurrences = useTaskOccurrenceExceptions()

  const fetcher = useTaskFetcher(dateStr, shared)

  const mutations = useTaskMutations(
    dateStr,
    shared,
    fetcher,
    occurrences,
    promptOccurrenceDecision,
  )

  const views = useTaskViews(
    fetcher.dailyTasks,
    fetcher.allTasks,
    dateStr,
    occurrences.occurrenceExceptionIndex,
    occurrences.applyOccurrenceAdjustments,
  )

  // ── Return the exact same shape as before ───────────────────────────
  return {
    dailyTasks: fetcher.dailyTasks || [],
    allTasks: fetcher.allTasks || [],
    dailyVisibleTasks: views.dailyVisibleTasks,
    scheduledTasks: views.scheduledTasks,
    upcomingTasks: views.upcomingTasks,
    completedTasks: views.completedTasks,
    getTaskForOccurrence: occurrences.getTaskForOccurrence,
    loading: fetcher.dailyLoading || fetcher.allLoading,
    error: fetcher.dailyError || fetcher.allError,
    createTask: mutations.createTask,
    toggleTaskCompletion: mutations.toggleTaskCompletion,
    batchUpdateTasks: mutations.batchUpdateTasks,
    deleteTask: mutations.deleteTask,
    refetch: () => {
      fetcher.refetchDaily()
      fetcher.refetchAll()
    },
  }
}
