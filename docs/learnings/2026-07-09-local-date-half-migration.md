# Switching date keys to local time requires migrating every reader AND writer

**Problem** — After fixing `dateStr`/`todayStrGlobal` to use local time instead of `toISOString()` (UTC), widget progress written in the evening (US timezones) vanished from charts, and the Fitbit sync overwrote real step counts with zeros.

**Approach** — Grep for every producer and consumer of YYYY-MM-DD keys and classify each as UTC or local: client writers (now local), server routes deriving their own "today" (`new Date()` on a UTC host = UTC), and chart axes built with `toISOString().slice(0,10)`. Any local-writer/UTC-reader pair is a bug that only fires during evening hours west of Greenwich — invisible in local dev where server tz == user tz.

**Solution** —
- Fitbit/GoogleFit fetches in `src/features/dashboard/hooks/use-integrations.ts` now pass `date=${todayStrGlobal()}` — the server default was server-local "today".
- `/api/trends/[instanceId]` accepts `?end=YYYY-MM-DD` from the client and steps its axis in UTC space from that anchor; both callers pass it.
- Withings charts (`widget-trend-chart.tsx`, `trends/[instanceId]/page.client.tsx`) keyed measurements by `measuredAt.slice(0,10)` (UTC) against a local axis — now `dateStr(new Date(m.measuredAt))`.
- One implementation: `dateStr` lives in `src/lib/date-utils.ts`; `dashboard-utils` re-exports it; `getCurrentLocalDate` delegates. Regression tests in `src/lib/__tests__/date-utils.test.ts`.

**Rule** — A server route must never derive "today" itself when the data is keyed by client-local dates — accept the date from the client and validate the format. When changing a date convention, grep for `toISOString().slice(0, 10)`, `toISOString().split('T')[0]`, and `.slice(0, 10)` on timestamp fields; every hit is a reader or writer that must move in the same change.

**Dead ends** — "The dates match in testing" — local dev servers share the user's timezone, so the bug only reproduces on a UTC host during local evening. Don't conclude it's fixed without reasoning through the UTC-host case.
