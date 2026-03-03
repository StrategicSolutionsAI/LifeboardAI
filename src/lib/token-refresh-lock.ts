/**
 * Token Refresh Lock — prevents concurrent refresh token operations for the
 * same integration from racing each other.
 *
 * Withings (and many OAuth providers) use refresh-token rotation: using a
 * refresh token invalidates it and issues a new one.  If two requests try to
 * refresh at the same time, the second one uses a now-invalid token and fails,
 * which can cascade into clearing all stored tokens.
 *
 * This module provides a simple in-memory deduplication layer.  If a refresh
 * is already in-flight for a given integration ID, subsequent callers get the
 * same promise instead of starting a competing refresh.
 */

const pendingRefreshes = new Map<string, Promise<unknown>>()

/**
 * Run `refreshFn` while holding a per-integration lock.
 * If a refresh is already in progress for `integrationId`, the caller awaits
 * the existing promise and receives the same result (or error).
 */
export async function withRefreshLock<T>(
  integrationId: string,
  refreshFn: () => Promise<T>,
): Promise<T> {
  const pending = pendingRefreshes.get(integrationId)
  if (pending) {
    return pending as Promise<T>
  }

  const promise = refreshFn().finally(() => {
    pendingRefreshes.delete(integrationId)
  })

  pendingRefreshes.set(integrationId, promise)
  return promise
}
