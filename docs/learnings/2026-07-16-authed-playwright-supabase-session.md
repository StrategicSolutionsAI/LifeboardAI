# Minting an authenticated Playwright session against local Supabase auth

**Problem** — Needed authenticated browser screenshots of every app page, but no test password exists and the app's session lives in @supabase/ssr cookies whose format (base64url JSON, `.0/.1` chunking) is version-dependent.

**Approach** — Don't reverse-engineer the cookie format; make the library produce it. (1) Admin client (`SUPABASE_SERVICE_ROLE_KEY`) → `auth.admin.generateLink({ type: 'magiclink', email })` — returns `properties.hashed_token` without sending any email. (2) Create a `createServerClient` from the app's own `@supabase/ssr` version with a custom `cookies: { getAll, setAll }` adapter that records writes into a Map. (3) Call `auth.verifyOtp({ type: 'magiclink', token_hash })` on that client — the library writes the exact chunked cookies the app expects. (4) Dump the Map to Playwright `context.addCookies` (domain `localhost`, ports don't matter for cookies).

**Solution** — Script pattern kept in the session scratchpad (`auth-cookies.js` + `shoot.js`); referenced by docs/engineering/UX_OVERHAUL_PLAN.md's verification strategy.

**Rule** — To authenticate an automated browser against a Supabase app, never hand-build session cookies and never drive the magic-link URL through the app (PKCE callback expects a `code`, not a token hash). Generate a magiclink token with the admin API, verify it through the app's own @supabase/ssr client with a recording cookie adapter, and inject the recorded cookies.

**Dead ends** — Visiting the generated `action_link` directly (redirects with tokens in a URL fragment the server callback never sees); setting the user's password via admin API (destructive to the real account); hand-encoding the `sb-*-auth-token` cookie (format drifts between ssr versions, chunking at 3180 chars).
