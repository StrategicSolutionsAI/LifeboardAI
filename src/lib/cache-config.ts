/**
 * Centralized cache TTL and timeout constants.
 *
 * Every module that needs a cache duration or fetch timeout should import
 * from here so values are easy to find, compare, and tune in one place.
 */

// ── React Query defaults ─────────────────────────────────────────────────
export const QUERY_STALE_TIME_MS = 5 * 60 * 1000      // 5 min
export const QUERY_GC_TIME_MS = 10 * 60 * 1000         // 10 min

// ── Data cache (useDataCache / useGlobalCache) ───────────────────────────
export const DATA_CACHE_DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 min

// ── Todoist in-memory task cache ─────────────────────────────────────────
export const TODOIST_TASK_CACHE_TTL_MS = 15 * 1000      // 15 sec

// ── Bucket colors (client-side) ──────────────────────────────────────────
export const BUCKET_COLORS_CACHE_TTL_MS = 5 * 60 * 1000 // 5 min

// ── Buckets snapshot ─────────────────────────────────────────────────────
export const BUCKETS_CACHE_TTL_MS = 2 * 60 * 1000       // 2 min

// ── Auth & preferences caches ────────────────────────────────────────────
export const AUTH_CACHE_TTL_MS = 30_000                  // 30 sec
export const PREFS_CACHE_TTL_MS = 60_000                 // 60 sec

// ── Greeting name prefetch ───────────────────────────────────────────────
export const GREETING_CACHE_TTL_MS = 60_000              // 60 sec

// ── Rate-limiter housekeeping ────────────────────────────────────────────
export const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000     // 60 sec

// ── Fetch timeouts ───────────────────────────────────────────────────────
export const FETCH_DEFAULT_TIMEOUT_MS = 5_000            // 5 sec
export const PREFETCH_TASKS_TIMEOUT_MS = 4_500           // 4.5 sec
