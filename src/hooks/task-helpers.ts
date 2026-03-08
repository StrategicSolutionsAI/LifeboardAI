import type { MutableRefObject } from 'react'
import type { Task } from '@/types/tasks'

// ── Pure helper functions ────────────────────────────────────────────

export const inferSourceFromId = (id?: string): Task['source'] => {
  if (!id) return 'supabase'
  if (/^\d+$/.test(id)) return 'todoist'
  if (id.startsWith('local-')) return 'local'
  return 'supabase'
}

export const ensureTaskSource = (task: Task, fallback?: Task['source']): Task => {
  if (!task) return task
  const source = task.source ?? fallback ?? inferSourceFromId(task.id)
  return task.source === source ? task : { ...task, source }
}

export const ensureTasksSource = (tasks: Task[] | null | undefined, fallback?: Task['source']): Task[] =>
  (tasks || []).map(task => ensureTaskSource(task, fallback))

export const isAbortLikeError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('abort') || message.includes('aborted')
  }
  return false
}

export const isNetworkFetchError = (error: unknown): boolean => {
  return error instanceof TypeError && error.message.includes('Failed to fetch')
}

// ── Module-level Todoist connection state ─────────────────────────────
// Persists across navigations so we don't re-probe Todoist on every page mount

let _todoistConnected: boolean | null = null

export function getTodoistConnected(): boolean | null {
  return _todoistConnected
}

export function setTodoistConnected(v: boolean | null) {
  _todoistConnected = v
}

// ── Shared state interface (passed between sub-hooks) ────────────────

export interface TaskSharedState {
  sharedFetchRef: MutableRefObject<Promise<Task[]> | null>
  sharedResultRef: MutableRefObject<{ data: Task[]; ts: number } | null>
  todoistConnectedRef: MutableRefObject<boolean | null>
  setTodoistConnected: (v: boolean | null) => void
  /** Timestamps of updates we made locally — skip refetch to avoid clobbering optimistic state */
  localUpdateTimestamps: MutableRefObject<Set<number>>
  /** When true, the next fetch will bypass server-side Todoist cache */
  nocacheRef: MutableRefObject<boolean>
}

// ── Interfaces ───────────────────────────────────────────────────────

export interface TaskUpdate {
  taskId: string
  updates: Partial<Task>
}
