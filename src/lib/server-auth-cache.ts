import type { AuthError, User } from '@supabase/supabase-js'
import { AUTH_CACHE_TTL_MS } from '@/lib/cache-config'

// Minimal structural contract so both the cookie client (createServerClient)
// and the bearer client (createClient) fit without generic gymnastics.
interface AuthClient {
  auth: {
    getUser(): Promise<{ data: { user: User | null }; error: AuthError | null }>
    getSession(): Promise<{ data: { session: { access_token: string } | null } }>
  }
}

type GetUserResult = { data: { user: User | null }; error: AuthError | null }

// Validated-token cache: an entry exists only for tokens Supabase Auth itself
// confirmed via getUser(). Serving from it for AUTH_CACHE_TTL_MS matches the
// trust model of the data layer — PostgREST accepts the same JWT until expiry
// without ever calling the auth server.
const validatedTokens = new Map<string, { user: User; at: number }>()
const MAX_ENTRIES = 500
// Within this window of token expiry, always call getUser() so the client's
// session-refresh side effects (rotating cookies) still run.
const EXPIRY_BUFFER_MS = 60_000

function tokenExpiryMs(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * Drop-in replacement for `supabase.auth.getUser()` that skips the ~90ms
 * network round-trip when the same access token was already validated in the
 * last AUTH_CACHE_TTL_MS. Pass the bearer token when the request carried one;
 * otherwise the token is read from the client's cookie-backed session
 * (local parse, no network).
 */
export async function getUserCached(
  supabase: AuthClient,
  explicitToken?: string | null
): Promise<GetUserResult> {
  let token = explicitToken ?? null
  if (!token) {
    const { data } = await supabase.auth.getSession()
    token = data.session?.access_token ?? null
  }

  if (token) {
    const entry = validatedTokens.get(token)
    const expiry = tokenExpiryMs(token)
    if (
      entry &&
      Date.now() - entry.at < AUTH_CACHE_TTL_MS &&
      expiry !== null &&
      expiry - Date.now() > EXPIRY_BUFFER_MS
    ) {
      return { data: { user: entry.user }, error: null }
    }
  }

  const result = await supabase.auth.getUser()
  const user = result.data?.user
  if (user && !result.error && token) {
    if (validatedTokens.size >= MAX_ENTRIES) validatedTokens.clear()
    validatedTokens.set(token, { user, at: Date.now() })
  }
  return result
}
