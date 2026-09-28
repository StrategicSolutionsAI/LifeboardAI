import { HOUSEHOLD_SCOPE_CACHE_TTL_MS } from '@/lib/cache-config'

/**
 * Which rows of a shared table (tasks, calendar, shopping, budget) a user may
 * see: their own, plus every row stamped with their household. RLS enforces
 * the same rule (supabase/migrations/20260928_household_sharing.sql); the
 * explicit filter keeps a drifted or missing policy from ever widening access.
 */
export interface DataScope {
  userId: string
  householdId: string | null
}

const scopes = new Map<string, { householdId: string | null; at: number }>()

export async function getDataScope(supabase: any, userId: string): Promise<DataScope> {
  const hit = scopes.get(userId)
  if (hit && Date.now() - hit.at < HOUSEHOLD_SCOPE_CACHE_TTL_MS) {
    return { userId, householdId: hit.householdId }
  }

  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  // Any failure (table missing before the migration runs) narrows to own rows.
  const householdId: string | null = error ? null : (data?.household_id ?? null)
  if (!error) scopes.set(userId, { householdId, at: Date.now() })
  return { userId, householdId }
}

/** Call after joining, leaving or creating a household. */
export function invalidateDataScope(userId: string): void {
  scopes.delete(userId)
}

/**
 * PostgREST `or` filter for rows the scope may see — chain as
 * `.or(ownedOrShared(scope))` wherever a shared-table query used to say
 * `.eq('user_id', user.id)`. Separate `.or()` calls are ANDed by PostgREST.
 */
export function ownedOrShared(scope: DataScope): string {
  return scope.householdId
    ? `user_id.eq.${scope.userId},household_id.eq.${scope.householdId}`
    : `user_id.eq.${scope.userId}`
}
