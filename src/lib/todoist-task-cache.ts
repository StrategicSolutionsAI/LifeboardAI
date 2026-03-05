type CacheEntry = {
  tasks: any[]
  expiresAt: number
}

const CACHE_SYMBOL = '__lifeboard_todoist_task_cache__'
const PENDING_SYMBOL = '__lifeboard_todoist_task_pending__'
const CACHE_NAMESPACE = 'todoist:tasks'

const globalAny = globalThis as Record<string, unknown>

function getCacheStore(): Map<string, CacheEntry> {
  if (!globalAny[CACHE_SYMBOL]) {
    globalAny[CACHE_SYMBOL] = new Map<string, CacheEntry>()
  }
  return globalAny[CACHE_SYMBOL] as Map<string, CacheEntry>
}

function getPendingStore(): Map<string, Promise<any[]>> {
  if (!globalAny[PENDING_SYMBOL]) {
    globalAny[PENDING_SYMBOL] = new Map<string, Promise<any[]>>()
  }
  return globalAny[PENDING_SYMBOL] as Map<string, Promise<any[]>>
}

const cacheStore = getCacheStore()
const pendingStore = getPendingStore()

const buildCacheKey = (userId: string) => `${CACHE_NAMESPACE}:${userId}`

export const TODOIST_TASK_CACHE_TTL_MS = 15 * 1000

export function readTodoistTaskCache(userId: string) {
  const key = buildCacheKey(userId)
  const entry = cacheStore.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cacheStore.delete(key)
    return null
  }
  return entry.tasks
}

export function writeTodoistTaskCache(userId: string, tasks: any[], ttlMs = TODOIST_TASK_CACHE_TTL_MS) {
  const key = buildCacheKey(userId)
  cacheStore.set(key, {
    tasks,
    expiresAt: Date.now() + Math.max(0, ttlMs)
  })
}

export function getTodoistPendingFetch(userId: string) {
  const key = buildCacheKey(userId)
  return pendingStore.get(key)
}

export function setTodoistPendingFetch(userId: string, promise: Promise<any[]>) {
  const key = buildCacheKey(userId)
  pendingStore.set(key, promise)
}

export function clearTodoistPendingFetch(userId: string) {
  const key = buildCacheKey(userId)
  pendingStore.delete(key)
}

export function invalidateTodoistTaskCache(userId: string) {
  const key = buildCacheKey(userId)
  cacheStore.delete(key)
  pendingStore.delete(key)
}

/** Clear all Todoist caches for every user (call on sign-out). */
export function clearAllTodoistCaches() {
  cacheStore.clear()
  pendingStore.clear()
}
