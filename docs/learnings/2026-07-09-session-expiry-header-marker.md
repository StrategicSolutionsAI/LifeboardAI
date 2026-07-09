# Cross-module behavior must ride on machine-readable markers, not error strings

**Problem** — The client's redirect-to-login on session expiry only fired when a 401 body was exactly `{ error: 'Not authenticated' }`. Three routes returned different 401 wording (`'Unauthorized'`, `'User not authenticated'`), so expired sessions on calendar pages never redirected — and any copy edit would silently kill the feature everywhere.

**Approach** — Grep every route reachable through the client wrapper (`fetchWithTimeout` callers → their endpoints → each endpoint's 401 body). Distinguish app-session 401s (from `supabase.auth.getUser()`) from provider-auth 401s (expired Todoist/Google tokens) — the latter must NOT sign the user out. The distinction has to be expressed by the server, not inferred by the client from prose.

**Solution** — `src/lib/session-expired.ts` exports `SESSION_EXPIRED_HEADER = 'x-session-expired'`. Set by `withAuth` (api-utils), by `handleApiError` for `AUTH_REQUIRED` 401s (covers cycle-tracking, household, preferences routes), and by the two bespoke 401 sites (calendar/upload, google calendar events). `fetchWithTimeout` checks only `res.headers.get(...)` — no body clone/parse, which also removed an abort-timer race on streaming 401 bodies. Tests in `src/lib/__tests__/fetch-with-timeout.test.ts`.

**Rule** — When client behavior depends on *why* a request failed, the server must emit a machine-readable marker (header or `code` field) from a shared constant, and the client must check only that. Never match on error-message text across module boundaries. Any new app-session 401 path must set `SESSION_EXPIRED_HEADER`.

**Dead ends** — Broadening the string match to a list of known messages just grows the fragile coupling. Parsing `res.clone().json()` on every 401 also costs a body tee and races the timeout's AbortController — header checks are free.
