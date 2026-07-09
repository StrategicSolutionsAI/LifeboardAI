# Measuring authenticated pages/APIs locally by minting a session

**Problem** — Every meaningful page and API in this app sits behind the auth wall, so curl/Playwright measurements (and visual verification) 307 to /login; there are no test credentials in .env.

**Approach** — The local `.env.local` has `SUPABASE_SERVICE_ROLE_KEY`. With it you can mint a real session for the user's own account without touching any data: `admin.auth.admin.generateLink({ type: 'magiclink', email })` → take `properties.hashed_token` → `client.auth.verifyOtp({ type: 'magiclink', token_hash })` → session. Encode the session as the `@supabase/ssr` cookie (`sb-<project-ref>-auth-token` = `base64-` + base64url(JSON), chunk at 3180 chars into `.0`, `.1` suffixes) and pass it to curl/Playwright.

**Solution** — Script pattern kept in scratchpad during the session (`mint-session.js`); writes the Cookie header to a file, never prints tokens. Used for: authenticated TTFB per route, API latency runs, and Playwright screenshots behind the wall.

**Rule** — When blocked on the auth wall for measurement or verification, mint a session for the user's own account via service-role generateLink+verifyOtp instead of asking for credentials, creating test users (they'd have no data, undermeasuring), or skipping verification. Never print token material; write cookies to a mode-600 file and reference it.

**Dead ends** — `/api/dev-access-token` needs an existing session cookie, so it can't bootstrap one. Reading the user's Chrome cookies: encrypted, invasive — don't. A fresh test user measures empty-state performance, which is not the user's experience.
