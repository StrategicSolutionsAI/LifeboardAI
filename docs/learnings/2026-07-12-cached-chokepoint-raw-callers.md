# A cached chokepoint doesn't help callers that still use the raw call

**Problem** — Realtime voice connect felt slow after the GA migration; an efficiency review traced ~180–270ms of the connect path to duplicate Supabase auth round trips inside an already-authenticated route.

**Approach** — Followed the request path past the `withAuth` wrapper: the route was authenticated via the cached path (`getUserCached`), but it then called `buildChatContext()`, which did its own raw `supabase.auth.getUser()` (~90ms network), which called `getUserPreferencesServer()`, which did *another* raw `getUser()`. The 2026-07-09 auth-cache work had wired the cache into the wrapper and middleware chokepoints but never grepped for the remaining raw call sites in shared helpers.

**Solution** — Swapped both helpers to `getUserCached(supabase)` (`src/lib/chat-context.ts`, `src/lib/user-preferences-server.ts`). Within a request the token is already in the validated-token cache, so both calls become local. All existing call sites of both helpers got faster for free.

**Rule** — When you introduce a drop-in replacement — a cache for an expensive call, or a helper extracted from copy-pasted code — immediately grep the whole project for the raw pattern you replaced; every remaining site silently re-pays the full cost, and helpers called *from* the replaced chokepoint are the likeliest offenders. (A second-pass review of this very fix found two more raw `getUser()` sites in the fitbit/googlefit metrics routes on the same hot path, plus a fifth inline copy of the expression `getRequestOrigin` had "fully" extracted.) In this repo: server code uses `getUserCached` from `src/lib/server-auth-cache.ts`, never raw `supabase.auth.getUser()`.

**Dead ends** — Threading `{ supabase, user }` from the route wrapper down through `buildChatContext`'s signature: works, but touches every caller and duplicates what the token cache already provides; the two-line swap achieves the same latency win. (See 2026-07-09-server-auth-token-cache.md for the cache's design and its test-mock gotcha: mocks need `getSession` returning `{ data: { session: null } }`.)
