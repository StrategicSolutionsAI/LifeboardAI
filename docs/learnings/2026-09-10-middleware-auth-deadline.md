# Bound authentication by the request deadline

Production page requests timed out in routing middleware after 25 seconds. The configured Supabase hostname failed DNS, while middleware awaited session refresh even on public pages. Supabase's refresh retry loop can continue beyond the platform response limit.

Public pages now avoid constructing the auth client. Protected pages have a five-second deadline across session refresh, retries and user validation, abort network requests, and show an uncached 503 recovery page. The middleware never forwards an unverifiable session. Late cookie callbacks are ignored; successful rotations completed before a later outage are preserved.

The installed SDK exposed two additional traps: `getSession` can perform network refresh, and a refresh 500/429 can remove its internal session. Discarding that refresh error causes the next lookup to report missing credentials. Preserve the original error and distinguish temporary unavailability from invalid credentials before forwarding deletion cookies.

Verification: 177 tests passed, production build/type-check/lint passed, independent review completed, and a real local production request with a synthetic expired session returned 503 in 5006 ms. Desktop/mobile recovery rendering and navigation were inspected. Backend restoration and deployment remain separate required steps; see `docs/engineering/MIDDLEWARE_TIMEOUT_PLAN.md`.

Durable rule: an individual fetch timeout does not bound a multi-call SDK operation. Test the overall response deadline against the installed SDK, including session rotation and retry behavior.
