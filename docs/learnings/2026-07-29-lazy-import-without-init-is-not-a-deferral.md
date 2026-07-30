# Sentry was 65% of the shared bundle despite every call site being lazy

**Problem** — Every route's First Load JS carried a 167 kB "shared by all" baseline, including
pages with ~350 B of their own code (`/history`, `/profile`).

**Approach** — Measured before theorizing. `next build` in an isolated worktree, then read the
artifacts rather than the source:

1. `.next/build-manifest.json` -> `rootMainFiles` lists what loads on *every* page. A 109 kB
   chunk sat there, and `app-build-manifest.json` confirmed it in **49 of 49** entries.
2. Identified the chunk by grepping it for strings that survive minification —
   `sentry-trace`, `baggage`, `captureException`, `Breadcrumb`. Package names and class names
   like `GoTrueClient` do *not* survive, so grepping for those returns 0 and proves nothing.
3. Only then read the source. Every app-level call site already used
   `import('@sentry/nextjs')` lazily. The single static import left was
   `instrumentation-client.ts`, which Sentry's webpack plugin injects into the client entry.

The trap: those lazy call sites only worked *because* init ran eagerly. `captureException` is a
silent no-op when no client is initialized, so deferring the init alone would have quietly turned
error reporting off while the build numbers looked great.

**Solution** — `src/lib/sentry-lazy.ts` exports `ensureSentry()`, which dynamic-imports **and**
initializes the SDK once (guarded by `Sentry.getClient()`), and every call site goes through it:
`instrumentation-client.ts` (on `requestIdleCallback`), `global-error-handler.tsx`,
`perf-observer.tsx`, `use-performance-monitor.ts`, `deferred-monitoring.tsx`,
`app/global-error.tsx`, `app/(app)/error.tsx`. Anything that must report before idle forces the
load itself. Also collapsed four duplicate local `getSentry()` helpers into the one chokepoint.
Measured: shared 167 kB -> 91 kB; every page route 68-76 kB lighter; Sentry in 0 of 49 entries.

**Rule** — A lazy `import()` only moves bytes if *nothing* on the entry path imports the module
statically; check `rootMainFiles` in `.next/build-manifest.json` to find out, not the source.
And when deferring a library whose `init()` arms the rest of its API, defer load and init
together behind one idempotent `ensure*()` function — otherwise the remaining lazy call sites
degrade into silent no-ops and the regression is invisible.

**Dead ends**
- Trimming Sentry integrations at runtime (`integrations: (d) => d.filter(...)`). Does not
  remove code from the bundle; that needs build-time flags like `__SENTRY_TRACING__: false`,
  which also throws away the tracing feature.
- Chasing `/calendar` (369 kB) and `/trends` (321 kB) as "the big routes" first. Both already
  do `dynamic(..., { ssr: false })` correctly; their weight was mostly the same shared baseline,
  so the per-route work would have been ~20 kB against a 76 kB win available on all 49 entries.
- Grepping chunks for `supabase` / `GoTrueClient` / package paths to identify contents.
  Minification renames them; only string literals survive.
