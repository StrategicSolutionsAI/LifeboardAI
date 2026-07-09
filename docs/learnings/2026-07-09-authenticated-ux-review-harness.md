# Authenticated full-app UX review harness

**Problem** — Needed to visually review every page of the app (including auth-gated ones) with no test credentials, no e2e auth setup, and no browser MCP tools.

**Approach** — In order:
1. Checked `tests/` + `playwright.config.ts` for existing auth state (none — only the example spec).
2. Checked dev-only routes (`/api/dev-access-token`) — dead end, they need an existing cookie session.
3. Listed `.env.local` var *names* only (`sed 's/=.*/=<set>/'`) — found `SUPABASE_SERVICE_ROLE_KEY`.
4. Created a disposable user via `supabase.auth.admin.createUser({ email_confirm: true })` with a `@lifeboard.test` email, then drove the real `/login` form with Playwright (which also exercises the login UX itself).
5. One walkthrough script: logged-out pass (public pages + redirect checks), login, all app routes, onboarding routes, then a mobile-viewport pass reusing `storageState`. Every page capture also recorded final URL, HTTP status, console errors, and ≥400 responses into a `notes.json` — the console/network trace surfaced systemic findings (unconditional integration fetches, CSP violations) no screenshot would show.
6. Interaction pass second: click through flows (chip selection, modals, chat) only after the static pass identified what to probe.
7. Fact-checked every visual finding against source before reporting (two findings needed correction: "© 2008" was a thumbnail misread; "onboarding buckets discarded" was actually "localStorage-only, no server persistence").
8. Deleted the test user via `admin.deleteUser` (script refuses to run on any email other than the known test one).

**Solution** — Scripts in session scratchpad: `create-user.mjs`, `shots.mjs`, `interact.mjs`, `delete-user.mjs`. Key plumbing: scripts outside the repo can't resolve project deps with ESM — use `createRequire('/abs/path/to/project/package.json')` and `require('@supabase/supabase-js')` / `require('@playwright/test')`; load env with `node --env-file=.env.local`.

**Rule** — For any "review/verify the whole app" task behind auth: mint a disposable Supabase user with the service-role key, log in through the real form, capture screenshots *and* per-page console/network traces in one pass, verify each finding in code before reporting, and delete the user when done. Full-page screenshots lie about scroll-reveal content — add a scroll-stepped pass for pages using IntersectionObserver reveals.

**Dead ends** — `NODE_PATH` (ignored by ESM); importing supabase-js's `dist/module` directly (extensionless internal imports fail in Node); `/api/dev-access-token` for bootstrap auth; trusting `fullPage: true` screenshots of the landing page (scroll-reveal made all below-fold sections look blank).
