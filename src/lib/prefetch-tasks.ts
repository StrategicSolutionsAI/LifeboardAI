import { prefetchToGlobalCache } from '@/hooks/use-data-cache'
import type { Task } from '@/types/tasks'

const CACHE_KEY = 'tasks-all-open'
const FETCH_TIMEOUT_MS = 4500

/**
 * Trigger task fetching as early as possible (e.g. at module evaluation time
 * in page.client.tsx) so data is ready when the heavy dashboard component
 * finally mounts. This runs in parallel with the JS chunk download.
 *
 * The fetch logic mirrors the core path in useTasks.fetchAllOpenTasks:
 *  1. Try Todoist → merge with Supabase
 *  2. Fall back to Supabase-only
 *
 * When useTasks later calls useDataCache('tasks-all-open', ...), it finds
 * either resolved data or an in-flight promise and skips its own fetch.
 */
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
        if (!res || !res.ok) return []
        try {
          const json = await res.json()
          const raw: Task[] = Array.isArray(json) ? json : (json.tasks ?? [])
          return raw.map(t => (t.source ? t : { ...t, source }))
        } catch {
          return []
        }
      }

      const todoistTasks = await parseTasks(todoistRes, 'todoist')
      const supabaseTasks = await parseTasks(supabaseRes, 'supabase')

      // Merge: Supabase first, Todoist overwrites duplicates
      const taskMap = new Map<string, Task>()
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
