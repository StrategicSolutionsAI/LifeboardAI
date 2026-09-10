# Keep page requests responsive during authentication outages

## Task brief

- Outcome: public pages load independently of Supabase; protected pages finish middleware authentication within five seconds and offer a safe retry when unavailable.
- Evidence: production screenshots show `/` and `/email` failing with `MIDDLEWARE_INVOCATION_TIMEOUT` after 25 seconds. The local Supabase hostname fails DNS resolution.
- Context: middleware awaits `getUserCached`, including session refresh; the installed Auth SDK retries refresh requests for roughly 30 seconds. No application deadline exists.
- Constraints: preserve unrelated performance changes, validated-token authentication, cookie rotation, deep links, CSP and nonce propagation. Never grant protected access on an unverifiable session.
- Non-goals: schema changes, dependency upgrades, replacing Supabase, unrelated favicon repair.
- Risk: high, because authentication and session cookies are affected.
- Done when: outage regressions prove bounded responses, valid/invalid authentication and refreshed cookies remain correct, build/type/lint/tests pass, independent review completes, and deployed service/configuration is verified or a precise external blocker is recorded.

## System map and invariants

`src/middleware.ts` → `src/utils/supabase/middleware.ts` → `getUserCached` → Supabase session refresh/user validation. API routes validate independently. Public login/signup pages do not require middleware user data; OAuth callback performs its own exchange.

- Public routes retain CSP without constructing an auth client.
- Protected requests require a validated user; missing/invalid credentials redirect to login with the destination preserved.
- Auth outages return an uncached 503, preserve browser cookies, and do not forward to protected content.
- One deadline covers session refresh, retries, and user validation; pending network work is aborted, and late cookie callbacks cannot mutate returned responses.
- Successful refresh reaches both downstream request headers and browser response cookies.

## Decisions

- Use a five-second overall deadline plus abortable fetch. A per-fetch timeout alone does not bound the SDK retry loop; merely increasing platform duration retains the outage.
- Return a self-contained retry page from middleware for unavailable authentication; rendering the protected route would reintroduce auth waits and weaken its gate.
- Preserve the existing validated-token cache rather than introducing a new authentication method.

## Milestones and verification

1. Verify Vercel project/environment and backend health without displaying credentials.
2. Add timeout/public-route/cookie/negative-auth regressions, demonstrate baseline failures, then implement the bounded middleware.
3. Test installed SDK behavior, run complete unit tests, build, type-check, lint and independent review. Inspect the retry page in a browser.
4. Resolve the backend configuration where access permits; validate live service. Keep deployment as a separate, explicit rollout step once the patch is reviewable.

## Rollout and operations

- Deploy the reviewed patch, check public 200s, unauthenticated redirects, authenticated content, and outage responses in the selected deployment.
- Monitor middleware timeout and `auth_timeout`/`auth_unavailable` logs. Logs must contain no tokens, cookies or query strings.
- Rollback is a source revert/redeployment; no migration or data changes.

## Progress

- [x] Traced middleware and installed SDK retries; confirmed Vercel CLI authenticated and linked to the screenshot project.
- [x] Production backend/configuration checked: authenticated Vercel CLI, project `lifeboard-ai-tk6j`, production Supabase hostname `bcirmyrlxbawprigaujo.supabase.co`, DNS `ENOTFOUND`. Repeated env inspection from a clean temporary linked directory to exclude `.env.local` overrides. No credentials displayed or environment changes made.
- [x] Regression tests and implementation complete.
- [x] Verification and independent review complete.
- [x] Live incident recovery verified after Supabase restoration and one project restart.
- [ ] Additional middleware hardening patch deployed (not performed).

## Verification evidence (2026-09-10)

- Before patch: 10 of 12 new middleware tests failed, including public auth calls, hung auth, fail-open behavior, exceptions and stale forwarded cookies. `/tmp/lifeboard-middleware-before.log`.
- After patch: 25 focused tests passed across middleware mocks, real installed Supabase SDK and auth-cache tests. `/tmp/lifeboard-middleware-sdk.log`.
- Real SDK tests cover refresh 429/500/503, a hung refresh and aborted retries, completed rotation followed by hung user lookup, revoked credentials and successful refresh propagation.
- Full Jest: 32 suites/177 tests passed; existing one skipped suite/four skipped tests. `/tmp/lifeboard-middleware-all-tests.log`.
- Production build, sequential postbuild type-check and lint passed. Lint retains existing unrelated warnings. Logs: `/tmp/lifeboard-middleware-build.log`, `/tmp/lifeboard-middleware-types.log`, `/tmp/lifeboard-middleware-lint.log`.
- `git diff --check` passed. Independent read-only reviewer reported no remaining actionable findings after correcting refresh-error masking, 429 classification and preservation of completed token rotations.
- Actual local production server on `127.0.0.1:3002`, real unreachable Supabase hostname, synthetic expired test cookie: `/` returned 200 in 223 ms; `/login` 200 in 29 ms; `/email?label=important` 503 in 5006 ms, Retry-After 5, no cookie deletion. Without cookies `/email` redirected 307 in 4 ms and preserved the full destination. These are local measurements, not production latency claims.
- Browser inspected the exact captured 503 HTML through a temporary local fixture at desktop and 390x844. Retry retains the destination, homepage recovery reaches the running application, and both layouts fit. Screenshots were inspected in the tool output; no screenshot files were saved. Response HTML: `/tmp/lifeboard-middleware-outage.html`.

## Review discoveries

- Existing cookie refresh rebuilt the downstream response using stale copied headers; fixed request-cookie propagation and covered it with both mocked and installed-SDK tests.
- `getUserCached` previously discarded refresh errors, potentially disguising a backend 500/429 as a missing session. It now returns the refresh error to its caller. API callers remain protected; broader API-specific availability responses are outside this middleware patch.
- A completed refresh must survive later validation failure. Outage responses retain completed rotation batches, omit deletion-only outage batches, and reject late callback writes.

## Residual risks

The user signed into Supabase during verification and restoration was already running. It progressed through "Restoration complete" and "Coming up" to "Unhealthy" with a critical "Database process is down" alert. Postgres logs showed backup recovery completing, controlled restarts, and acceptance of connections at 15:18:33 UTC. Roughly five minutes later the public hostname still returned NXDOMAIN and auth health failed; the live browser's existing `/email` session still hit the original 504. Unauthenticated live HTTP checks returned homepage 200, login 200 and `/email` 307; these do not prove authenticated recovery.

At approximately 15:24 UTC, after inspecting logs, the agent initiated one standard Restart project action for the existing unhealthy project through Supabase settings. The UI acknowledged "Restarting". No project deletion, reset, schema/data edit, upgrade or credential change was made.

After the restart, public DNS resolved the hostname again. The auth health endpoint returned HTTP 200 in 215 ms with production configuration, using a DNS lookup from the resolver to avoid the local OS's stale negative cache (TLS hostname verification remained enabled). More decisively, the live Vercel `/email` route opened using the browser's existing session and loaded the inbox: Email heading, INBOX button and 21 selection checkboxes verified. No email was opened, sent or changed. The recovered inbox remains open as a deliverable. This verifies recovery of the existing deployment, not deployment of the local patch.

No deployment, commit or environment update has been performed. Existing local performance edits are outside this patch's review scope and must be accounted for before deployment. Remaining follow-up: roll out the reviewed hardening patch with the existing changes accounted for. Supabase overview still showed an unhealthy status at the last dashboard read before successful live inbox verification; monitor whether that health indicator clears. Local OS DNS had retained a negative entry even after resolver DNS succeeded; no system DNS settings or caches were changed.
