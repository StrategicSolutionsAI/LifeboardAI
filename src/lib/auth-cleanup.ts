import { invalidateAuthCache, invalidatePreferencesCache } from '@/lib/user-preferences'
import { invalidateGreetingNameCache } from '@/lib/prefetch-user-prefs'
import { clearAllTodoistCaches } from '@/lib/todoist-task-cache'
import { resetQueryClient } from '@/lib/query-client'
import { invalidateBucketsCache } from '@/hooks/use-buckets'

/** The localStorage key that records which user owns the cached data. */
const OWNER_KEY = 'lifeboard:cache-owner'

/** localStorage keys that hold user-specific data and must be purged on sign-out. */
const USER_DATA_KEYS = [
  'life_buckets',
  'active_bucket',
  'bucket_colors',
  'widgets_by_bucket',
  'widget_progress',
  'progress_by_widget',
  'life_buckets_saved_at',
  'life_buckets_synced_at',
  'fitbit_metrics',
  'googlefit_metrics',
  'withings_metrics',
  'todoist_all_tasks',
  'lifeboard_local_tasks',
  'lifeboard:last-tasks-update',
  'lifeboard:onboarded',
  'user_theme',
  'theme_colors',
  'custom_themes',
  'calendar-selected-date',
  'calendar-view',
]

/**
 * Wipe every client-side cache that may hold data from the previous user.
 * Call this on SIGNED_OUT (and proactively in handleSignOut) to prevent
 * a subsequent login from displaying stale data belonging to another account.
 */
export function clearAllUserCaches() {
  // In-memory singleton caches
  invalidateAuthCache()
  invalidatePreferencesCache()
  invalidateGreetingNameCache()
  clearAllTodoistCaches()
  invalidateBucketsCache()

  // React Query cache (singleton QueryClient)
  resetQueryClient()

  // localStorage
  if (typeof window !== 'undefined') {
    for (const key of USER_DATA_KEYS) {
      localStorage.removeItem(key)
    }
    localStorage.removeItem(OWNER_KEY)
  }
}

/**
 * Ensure localStorage data belongs to the given user.  If the stored owner
 * differs (or is absent), wipe all user data caches so the new user starts
 * with a clean slate.  Call this early in the dashboard when the authenticated
 * user is known.
 *
 * @returns `true` if caches were purged (i.e. the user changed).
 */
export function ensureCacheOwner(userId: string): boolean {
  if (typeof window === 'undefined') return false
  const storedOwner = localStorage.getItem(OWNER_KEY)
  if (storedOwner === userId) return false

  // Different user (or first visit) — purge everything
  clearAllUserCaches()
  localStorage.setItem(OWNER_KEY, userId)
  return true
}
