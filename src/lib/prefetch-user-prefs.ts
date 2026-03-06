import { getCachedUser, getUserPreferencesClient } from '@/lib/user-preferences'
import { supabase } from '@/utils/supabase/client'
import { GREETING_CACHE_TTL_MS } from '@/lib/cache-config'

// Greeting name prefetch with dedup + short-lived cache
let _greetingNamePromise: Promise<string | null> | null = null
let _greetingNameCache: { name: string | null; ts: number } | null = null

/**
 * Start fetching user preferences as early as possible (module evaluation time).
 * This triggers getCachedUser() → getUserPreferencesClient() in advance,
 * so by the time TaskBoardDashboardInner runs loadBuckets/loadWidgets,
 * the data is already in the in-memory cache.
 */
export function prefetchUserPreferences(): void {
  if (typeof window === 'undefined') return
  void getUserPreferencesClient().catch(() => {
    // Swallow — the component will retry via its normal path.
  })
}

/**
 * Start fetching the greeting name (profiles.first_name) in parallel.
 * Deduplicates concurrent calls and caches for 60s.
 */
export function prefetchGreetingName(): void {
  if (typeof window === 'undefined') return
  if (_greetingNameCache && Date.now() - _greetingNameCache.ts < GREETING_CACHE_TTL_MS) return
  if (_greetingNamePromise) return

  _greetingNamePromise = (async () => {
    try {
      const user = await getCachedUser()
      if (!user) return null
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', user.id)
        .maybeSingle()
      const name = profile?.first_name ?? null
      _greetingNameCache = { name, ts: Date.now() }
      _greetingNamePromise = null
      return name
    } catch {
      _greetingNamePromise = null
      return null
    }
  })()
}

/** Invalidate the greeting name cache (call on sign-out). */
export function invalidateGreetingNameCache() {
  _greetingNameCache = null
  _greetingNamePromise = null
}

/**
 * Get the prefetched greeting name. Returns immediately if cached,
 * or awaits the in-flight promise if prefetch was already started.
 */
export async function getPrefetchedGreetingName(): Promise<string | null> {
  if (_greetingNameCache && Date.now() - _greetingNameCache.ts < GREETING_CACHE_TTL_MS) {
    return _greetingNameCache.name
  }
  if (_greetingNamePromise) return _greetingNamePromise
  prefetchGreetingName()
  return _greetingNamePromise
}
