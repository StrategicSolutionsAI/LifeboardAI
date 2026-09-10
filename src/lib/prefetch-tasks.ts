import { prefetchToGlobalCache } from '@/hooks/use-data-cache'
import type { Task } from '@/types/tasks'
import { ensureTasksSource } from '@/hooks/task-helpers'
import { PREFETCH_TASKS_TIMEOUT_MS } from '@/lib/cache-config'
import { SESSION_EXPIRED_HEADER } from '@/lib/session-expired'

const CACHE_KEY = 'tasks-all-open'
const FETCH_TIMEOUT_MS = PREFETCH_TASKS_TIMEOUT_MS

/**
 * Trigger task fetching as early as possible (e.g. at module evaluation time
 * in page.client.tsx) so data is ready when the heavy dashboard component
 * finally mounts. This runs in parallel with the JS chunk download.
 *
 * Merge open local tasks with Supabase and Todoist. A disconnected Todoist
 * account is expected; other failures leave the cache unseeded so the mounted
 * task loader can recover through its normal fallback path.
 *
 * When useTasks later calls useDataCache('tasks-all-open', ...), it finds
 * either resolved data or an in-flight promise and skips its own fetch.
 */
let tasksViewChunksPrefetched = false

/**
 * Warm the ssr:false view chunks for /tasks (list, board, kanban) ahead of
 * navigation. dynamic() chunks are not covered by <Link> prefetch, so without
 * this they only start downloading after the click commits.
 */
export async function prefetchTasksExperience(): Promise<void> {
  if (tasksViewChunksPrefetched) return
  tasksViewChunksPrefetched = true

  await Promise.allSettled([
    import('@/features/tasks/components/task-list-view'),
    import('@/features/tasks/components/TasksBoard'),
    import('@/features/tasks/components/task-kanban-board'),
  ])
}

export function prefetchAllTasks(): void {
  if (typeof window === 'undefined') return

  prefetchToGlobalCache<Task[]>(CACHE_KEY, async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const safeFetch = async (url: string): Promise<Response | null> => {
      try {
        return await fetch(url, {
          credentials: 'same-origin',
          signal: controller.signal,
        })
      } catch {
        return null
      }
    }

    try {
      // Fire both requests in parallel to save time
      const [todoistRes, supabaseRes] = await Promise.all([
        safeFetch('/api/integrations/todoist/tasks?all=true'),
        safeFetch('/api/tasks?all=true'),
      ])

      const parseTasks = async (
        res: Response | null,
        source: Task['source']
      ): Promise<Task[]> => {
        // Only a disconnected provider is an expected empty result. Network,
        // session and server failures must not populate a five-minute cache.
        if (source === 'todoist' && res && (res.status === 400 || res.status === 401) && res.headers.get(SESSION_EXPIRED_HEADER) !== '1') return []
        if (!res || !res.ok) throw new Error(`Task prefetch failed: ${res?.status ?? 'network'}`)
        const json = await res.json()
        const raw = Array.isArray(json) ? json : json.tasks
        if (!Array.isArray(raw)) throw new Error('Invalid task prefetch response')
        return ensureTasksSource(raw, source)
      }

      const [todoistTasks, supabaseTasks] = await Promise.all([
        parseTasks(todoistRes, 'todoist'),
        parseTasks(supabaseRes, 'supabase'),
      ])

      // Merge: remote records override local copies; Todoist wins duplicates.
      const taskMap = new Map<string, Task>()
      try {
        const local = JSON.parse(localStorage.getItem('lifeboard_local_tasks') || '[]')
        if (Array.isArray(local)) {
          ensureTasksSource(local, 'local').filter(t => !t.completed).forEach(t => taskMap.set(t.id, t))
        }
      } catch { /* Malformed local data must not block remote tasks. */ }
      supabaseTasks.forEach(t => taskMap.set(t.id, t))
      todoistTasks.forEach(t => taskMap.set(t.id, t))

      const merged = Array.from(taskMap.values())
      merged.sort((a, b) => {
        const posA = a.position ?? Number.MAX_SAFE_INTEGER
        const posB = b.position ?? Number.MAX_SAFE_INTEGER
        return posA - posB
      })

      return merged
    } finally {
      clearTimeout(timeout)
    }
  })
}
