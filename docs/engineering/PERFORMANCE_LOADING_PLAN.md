# Faster content loading

## Task brief
- Outcome: Reduce unnecessary requests and loading delays across the application, prioritizing tasks/dashboard and independent loading waterfalls found in review.
- Evidence: Task prefetch seeds `tasks-all-open`, but daily queries call a separate fetcher and repeat both backend requests. Failed prefetches become successful empty data for five minutes. Baseline production build captured in /tmp/lifeboard-perf-baseline-build.log.
- Context: Next 14 App Router, React Query, Supabase authentication and external integrations. Existing lazy imports and navigation prefetching already cover most large UI features.
- Constraints: Preserve authentication, user isolation, optimistic mutations, local-task fallback, data freshness and unrelated worktree changes. No deployment, schema changes or dependency upgrades.
- Risk: Medium: shared task cache and inbox request scheduling.
- Done when: Confirmed bottlenecks addressed, same-scenario before/after request or latency measurements retained, regression tests and type/lint/build checks pass, browser smoke checks and final diff review recorded.

## System map and invariants
- Dashboard/tasks module prefetch -> global React Query all-open cache -> useTaskFetcher daily/all consumers -> task mutations and global refresh events.
- Browser calls authenticated API routes; credentials and server authorization stay unchanged.
- Daily and all-task optimistic cache interfaces must remain compatible. Forced refresh must bypass fresh cached data; concurrent readers share network work.
- Prefetch failure must not masquerade as an empty account.

## Decisions
- Retain separate daily/all cache interfaces for existing optimistic mutations; make daily reads reuse the canonical all-open query rather than redesign mutation state.
- Optimize independent I/O only after establishing dependencies and error behavior; do not add server caches of personal data.

## Milestones
1. [x] Map initial loading, cache and chunk paths; capture production baseline.
2. [x] Add task request-count/failure regressions, implement canonical cache handoff and verify explicit refresh.
3. [x] Remove inbox label barrier and duplicate request; verify messages start while labels remain pending, account fallback and stale-response protection.
4. [x] Run relevant/full Jest, type-check, lint, build, accessible-page browser/HTTP smoke and final review. Record authenticated verification limitation.

## Rollout and verification
- Ship through normal review/deployment flow; no publish requested here.
- Observe task request counts, content availability and integration error rates after deployment.
- Rollback: revert the focused code changes; no persisted-data or migration effects.
- Existing dirty files (workflow, AGENTS.md, SECURITY.md and engineering setup) are outside this change.

## Progress and remaining work
- 2026-09-10: Review and focused fixes completed. Seventeen new regressions cover the measured request reductions, failure recovery, refresh races and inbox readiness. All local code gates pass.
- Live authenticated provider timings may require an available account; deterministic mocked I/O comparisons will be labeled as such.


## Review findings and changes
- **P2, addressed:** Daily task queries bypassed prefetch, causing duplicate Supabase and Todoist requests. Daily queries now obtain the canonical all-open query. React Query replaces the redundant per-hook 30-second cache.
- **P2, addressed:** Prefetch treated errors as successful empty tasks. Network, malformed-response, app-auth and server failures now leave the cache recoverable. Expected disconnected-provider responses remain supported; local open tasks are included.
- **P2, addressed:** A successful empty Supabase response was fetched again during fallback. The fallback now reuses the initial request.
- **P2, addressed:** Inbox readiness waited for labels and then fetched them again for the account. Messages and account labels now load concurrently after account resolution; stale account-label responses are ignored.
- Review exposed a cancellation edge with multiple daily consumers. Refresh now cancels all daily readers and the canonical reader before invalidating/refetching active consumers. Synchronous sibling refresh calls coalesce; later writes start a new snapshot.

## Before/after evidence
The same tests were run against the original implementation before editing and then against the changes. These are deterministic component/hook tests using mocked HTTP responses, not production latency measurements.

| Scenario | Before | After |
| --- | --- | --- |
| Resolved task prefetch, mount and date navigation | 4 source requests | 2 source requests |
| In-flight task prefetch plus mounted views | 4 source requests | 2 source requests |
| Daily/all refresh pair | 4 source requests | 2 source requests |
| Empty Supabase account with disconnected Todoist | 3 source requests | 2 source requests |
| Failed 500/401 prefetch | Successful empty cache | No successful cached data; mounted loader recovers |
| Inbox while labels response remains pending | Messages never start | Messages start without labels |
| Initial Gmail labels | Unscoped read then account read | One account read |
| Disconnected Gmail | Unnecessary labels request | Status/accounts only |

Baseline failures: `/tmp/lifeboard-task-baseline-tests.log` and `/tmp/lifeboard-email-baseline-tests.log`. Current regressions: `src/hooks/__tests__/use-task-fetcher-loading.test.tsx` and `src/app/(app)/email/__tests__/loading.test.tsx`. Coverage also includes local task precedence, failed in-flight prefetch retry, obsolete responses after writes, successive writes, multiple active dates, persisted/removed Gmail accounts and late label responses.

## Verification status
- Full Jest: 30 suites passed, 158 tests passed; one existing skipped suite / four skipped tests.
- Lint: passes with existing accessibility/hook warnings; no new warning in changed logic.
- Production baseline and first after-build passed. First-load JS stayed effectively unchanged: dashboard 150 kB, tasks 207 kB, email 142 kB, calendar 296 kB, shared 91.1 kB. This work optimizes request scheduling rather than bundle size.
- Final `npm run build`, post-build `npm run type-check`, `npm run lint`, `npm test -- --runInBand`, and `git diff --check` all passed. One earlier concurrent type-check raced Next's generated type cleanup; the sequential post-build rerun passed.
- Independent read-only final review: no remaining actionable findings after cancellation correction and regressions.
- Final production server: listener confirmed at 127.0.0.1:3001; homepage HTTP 200 / 173630 bytes and login HTTP 200 / 28727 bytes. Browser reached the local sign-in screen with deep-link redirect preserved. Authenticated live content verification is unavailable: configured Supabase hostname fails DNS resolution both in sandboxed server logs and an unrestricted `curl` probe (exit 6). No claim is made about production latency or live-provider behavior.

## Follow-ups from review
- Uploaded-calendar GET performs legacy task-link repair and reads all uploaded events. Date bounding or moving repair out of GET needs a separate recurrence/backfill compatibility design and real-account payload measurements; no schema changes in this update.
- Notes lists include full note bodies to support existing client-side full-text search. Measure large-account payloads before changing that search/editor contract.
- After restoring Supabase connectivity, compare authenticated cold/warm loads and mutation/navigation interactions against a real account.
- No deployment or commit was requested or performed. Rollback requires only reverting this focused source diff; no data migration or external mutation.

Browser screenshot capture was attempted but the automation timed out. The browser accessibility tree verified the sign-in content; no authenticated visual or live-provider performance claim is supported. Existing Playwright smoke configuration points to port 3000, occupied by an unrelated project; it was not run against that project. No merge is proposed.

## Completion boundary
Implementation and local verification are complete. The thread goal remains active pending authenticated behavior/visual verification against a reachable Supabase project. Requested restoration of the configured project or its current URL; no credentials requested. This is the first blocked live-verification turn, not a completed goal.

### Backend revalidation — second consecutive blocked turn
- Previous turn made progress: implementation, regressions, build/type/lint gates and review completed.
- Retried with unrestricted network permissions: configured project hostname still fails (`curl` exit 6; DNS `ENOTFOUND`). Control lookup for `supabase.com` succeeds, isolating the failure to the project hostname rather than general DNS/network access.
- Local production listener remains live on 127.0.0.1:3001. Source changes are intact.
- No backend URL response has arrived. Authenticated verification still needs project restoration or the current project URL. Goal remains active; blocked threshold not yet reached.

### Backend revalidation — third consecutive blocked turn
- Previous turn supplied evidence isolating the blocker to the configured project DNS; no remaining independent implementation or local verification work was identified.
- Re-read `.env.local` hostname and retried DNS: project remains `ENOTFOUND`, while `supabase.com` resolves. Worktree changes and passing test evidence remain intact.
- The same external blocker has persisted across three consecutive goal turns. Goal is now blocked, not complete. Resume authenticated task/inbox loading, mutation/date-navigation, and visual verification after the project is restored or its current URL is supplied.
# Backend recovery update — 2026-09-10

The later middleware incident investigation verified that Vercel production used the same unavailable Supabase hostname. The user signed into Supabase and restoration completed, but the project remained unhealthy. One project restart recovered DNS and authentication; the existing production email page then loaded the inbox with the existing browser session. The original backend blocker has therefore changed: production access recovered, while local OS DNS still held a stale negative entry at the last check. No deployment of the local performance or middleware fixes has been performed. Full local authenticated performance acceptance remains pending. See `docs/engineering/MIDDLEWARE_TIMEOUT_PLAN.md` for incident evidence, the tested timeout protection, and remaining release work.
