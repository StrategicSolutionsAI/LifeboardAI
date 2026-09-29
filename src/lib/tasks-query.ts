/**
 * The one URL for the app's task list: every open task, plus tasks finished
 * since the client's local midnight — so "Completed today" and the Today
 * progress ring survive a reload. The prefetch and the fetcher must both use
 * this builder, or they warm a cache entry nothing reads.
 */
export function allTasksUrl(now: Date = new Date()): string {
  const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return `/api/tasks?all=true&completedSince=${encodeURIComponent(localMidnight.toISOString())}`
}
