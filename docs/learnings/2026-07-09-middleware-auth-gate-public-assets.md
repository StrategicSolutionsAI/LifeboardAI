# Auth-gating middleware silently breaks cookie-less public assets

**Problem** — After adding a redirect-to-login gate in middleware, `/manifest.json`, `/sw.js`, `/robots.txt`, `/sitemap.xml`, `/offline.html`, `/opengraph-image` and `/apple-icon` all 307'd to `/login`. The manifest broke even for logged-in users.

**Approach** — Enumerate everything the matcher touches that is fetched *without cookies*: PWA assets (manifest fetches omit credentials by spec; SW scripts hard-fail on redirects), crawler routes, and Next metadata routes. Then curl each path cookie-less against the dev server — a 307 with `location: /login` confirms the break in seconds. Separately, check what `supabase.auth.getUser()` returns on *network failure*: `{ user: null, error: AuthRetryableFetchError }` — indistinguishable from logged-out unless you read `error`.

**Solution** —
- `src/middleware.ts`: matcher now excludes `sw\.js|manifest\.json|offline\.html|robots\.txt|sitemap\.xml|opengraph-image|apple-icon` (skips the getUser round-trip entirely for assets).
- `src/utils/supabase/middleware.ts`: fail open when `error?.name === 'AuthRetryableFetchError'` (offline Electron / Supabase outage must not lock out valid sessions); redirect carries `?redirect=<path+search>` (sanitized in `src/app/login/actions.ts` to same-origin paths) so login returns to the deep link.
- `emailSignUp` checks `data.session` — with confirm-email enabled there is no session, so it shows a check-your-email message on `/login` instead of bouncing through the gate.

**Rule** — When adding any auth gate in middleware: (1) list every path fetched without cookies (PWA, crawlers, metadata routes) and exempt them in the matcher; (2) never treat an auth-check *error* as "logged out" — check the error type and fail open on retryable/network errors; (3) always carry the original destination in a sanitized redirect param. Verify by curling each public path cookie-less and asserting 200.

**Dead ends** — Adding the assets to `PUBLIC_PATHS` works but still costs a Supabase Auth network round-trip per robots.txt fetch; the matcher exclusion is strictly better. Also: the "stale requestHeaders snapshot in setAll" pattern looks like a cookie-forwarding bug vs the canonical @supabase/ssr example, but Next 14.2's `x-middleware-set-cookie` merge compensates — not worth "fixing" without evidence.
