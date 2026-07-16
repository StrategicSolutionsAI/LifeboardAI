# UX overhaul: every page reviewed, prioritized fix plan

## Task brief

- **Outcome:** Every page of LifeboardAI is functionally correct, visually consistent with the warm-brand token system, free of dead weight, and coherent on mobile. This plan is the reviewed, prioritized backlog to get there.
- **Evidence/current behavior:** Full-app visual audit on 2026-07-16 — 34 authenticated Playwright screenshots (desktop 1440px + mobile 390px) of all 26 routes against the local dev build, plus console-error capture and code tracing of every defect found. Screenshots: session scratchpad `shots/` (regenerate with the method in "Verification").
- **Context:** Solo-user personal life dashboard, Next.js 14 + Supabase, warm golden-brown brand (#B1916A), 3-layer token system (STYLE_GUIDE.md). Legal pages shipped 2026-07; pricing was explicitly deferred pending user decisions.
- **Constraints:** One deliverable per session; schema changes require migration files; no destructive SQL without user sign-off; visual verification required for every UI change (`/verify-ui-change`).
- **Non-goals:** New feature development (this is optimize/clean-up/coherence work); Electron-specific UI; the Trends detail page (needs a live widget instance to review — deferred).
- **Risk:** Medium — M1 touches the root layout (CSP) and a DB column type; everything else is low-risk page-level work.
- **Done when:** Each milestone's verify step passes and a re-run of the screenshot audit shows the defect gone.

## System map

- **Entry points:** `src/app/layout.tsx` (root, CSP-sensitive inline scripts), `src/app/(app)/*/page.tsx` (13 app pages), `src/app/page.tsx` (landing), `src/app/onboarding/0-6`, auth pages.
- **Existing patterns to extend:** token system `src/lib/styles.ts`; `withAuth`/`withAuthAndBody` API wrappers; repository layer; `verify-ui-change` skill.
- **Trust boundaries:** middleware nonce CSP (`src/middleware.ts`); Supabase RLS; Gmail/ICS content is untrusted input rendered in the UI.
- **Existing tests/observability:** Jest route tests colocated; Playwright config present but `tests/` has only the example spec — the audit script from this review is the de-facto visual harness.

## Invariants

- Every schema change ships as a `supabase/migrations/` file in the same PR as dependent code.
- No hardcoded hex / raw Tailwind palette colors in components; brand is #B1916A warm golden brown, never black CTAs.
- All HTML routes render dynamically (nonce CSP); any inline `<script>` must carry the request nonce.
- Server routes never derive "today" — client sends local dates.
- A page is "done" only after visual verification in both themes at desktop + 390px.

---

## Findings A — verified defects (root cause traced)

| # | Defect | Root cause / location |
|---|--------|----------------------|
| A1 | Both root-layout inline scripts are CSP-blocked on **every page**: service worker never registers (PWA dead) and the theme anti-flash script never runs (custom themes flash default colors on load) | `src/app/layout.tsx:112` and `:124` — `dangerouslySetInnerHTML` scripts without the middleware nonce |
| A2 | `POST /api/widgets/progress` 500s on every dashboard load with a weight widget; weight history silently never saves | `widget_progress_history.value` is `int` (migration `20250801_create_widget_progress_history_table.sql:7`); dashboard posts `122.6` → Postgres `22P02`. Reproduced live |
| A3 | Email list renders raw HTML entities ("today&amp;#39;s", "haven&amp;#39;t") | `src/app/(app)/email/page.client.tsx:271,1056` render Gmail's entity-encoded `snippet` without decoding |
| A4 | Imported ICS events show impossible times (Austin FC kickoff "12:30 AM") | ICS import timezone handling (`Austin_FC.ics`, 35 events) — likely UTC parsed as local or floating time misread; verify against the source file |
| A5 | "+ Add Expense" button on /budget is visually clipped (text overflows its fill) | Budget page header action styling |
| A6 | React `flushSync` warning on /calendar (console, every load) | flushSync called during lifecycle in calendar view code |
| A7 | Geolocation Permissions-Policy violation on /dashboard | Weather/location widget requests geolocation that the app's own Permissions-Policy header blocks — either allow it or stop requesting |
| A8 | Landing page below-fold sections are invisible until JS runs and the user scrolls (blank for crawlers/screenshots/no-JS) | `.scroll-reveal` opacity-0 default, `src/components/landing/scroll-reveal.tsx` |
| A9 | /onboarding/5 is a stub that client-redirects to /6; 7 routes for 6 steps | `src/app/onboarding/5/page.tsx` ("consolidated into step 4") |
| A10 | Onboarding step 3: "Home" listed in *Your selected buckets* AND highlighted in *Suggestions* | suggestions list not de-duplicated against selected buckets |
| A11 | Integrations page shows Todoist "Active" beside "Last synced 9/20/2025" (~10 months stale) | status badge derived from token presence, not sync recency — contradictory status is a trust bug |

## Findings B — critical UX review (per page)

**Cross-cutting (highest leverage):**
1. **Meta-stat rows waste the prime viewport on every page.** Dashboard's first row is stats *about widgets* ("3 Total Widgets, 0 In Progress"); Tasks shows "0 In Progress / 0 Done" (statuses never used) plus a demotivating "0%" ring; Shopping shows "13 Buckets" as a stat for a 1-item list. On mobile these cards fill the entire first screen before any real content.
2. **One taxonomy, three UIs.** 13 bucket tabs on the dashboard (no overflow strategy, near-collision at 1440px), a Folders page of giant pastel folders repeating the same 13 names, and the onboarding bucket picker. Health/Wellness/Medical overlap invites junk-drawer categories.
3. **Unused workflow machinery.** Status column 100% "To Do" across 49 tasks; Assignee column entirely empty; both "Board" *and* "Kanban" views. The household/assignee feature is latent — hide it until it's real.
4. **Off-brand elements everywhere:** black CTAs (Connect Google Calendar, Amazon connect, One-time toggle, landing "START NOW" band), gold→black gradient CTAs in onboarding, random pastel folder colors, emoji integration icons (📝📅📧🏃) instead of logos, unstyled native `<select>`s.
5. **Brand naming inconsistency:** "Lifeboard." (landing) / "Sign in to Lifeboard" / "Join Lifeboard.ai today" (signup) / "LifeboardAI" (onboarding) / "LIFEBOARD" (sidebar). Pick one.
6. **Header wasted on Sign out.** The only global header action on every app page is Sign out — the most prominent slot invites leaving. No user menu/avatar; /profile is a "coming soon" stub yet Settings duplicates profile actions.
7. **Truthfulness:** landing advertises "Join 50,000+ obsessive organizers", "4.9★ user rating", and a $0/$18/$39 pricing page with "14-day free trial" — none of which exist (billing was deliberately deferred). Now that real legal pages shipped, fabricated claims are a liability. Decide pricing or de-scope the section; delete the fake social proof (`src/components/footer-cta.tsx`).

**Per page:**
- **Dashboard:** greeting band + widget-meta stats push real content below the fold; "Refresh" as text-button; per-bucket sub-nav (Overview/Trends/Logs/Tasks/Settings) duplicates global nav concepts; weekday dots on habit widgets start on Friday (rolling window reads as mislabeled week); "Add Widget" ghost card good.
- **Tasks:** Overdue shown as red label **without the date** — can't triage 2-days vs 2-months; single flat "TO DO 49" group (no due-date/bucket grouping); mobile keeps the constant Status column and **drops due dates entirely** — the one column that matters.
- **Calendar:** desktop defaults to Day view = a screenful of empty hour grid with one all-day event; date rendered twice (toolbar + heading); a Tasks/Habits panel lives on the calendar page (IA confusion) with unexplained "Add Sticker" and an ambiguous chevron; mobile agenda renders a "No events scheduled" row for every empty day — mostly noise. Mobile's Agenda default is right; desktop should match it or default to Week.
- **Budget:** empty state shows fake-perfect "100% Health Score" and 15 identical "Set budget" rows instead of a setup wizard; native select; clipped Add Expense button (A5).
- **Email:** solid Gmail-style layout; entity bug (A3); no unread/read visual distinction; "AI TOOLS" (Filter Spam/Organize/Sweep/Clean Up) don't state their scope (selection? inbox?); red badge counts disagree between rail (28) and page (20) — pick one source of truth.
- **Folders:** giant skeuomorphic pastel folders duplicate bucket management; counts unreadably small; page earns a top-nav slot without earning its existence — fold bucket management into Settings or dashboard tab management.
- **Shopping:** stat cards for a 1-item list; "Unsorted" chip begs for bucket assignment inline.
- **Integrations:** stale-sync-with-Active badge (A11); emoji icons; black CTA; "Uploaded Calendars" section with native selects and heavy red Delete; Amazon page asks consumers for Selling-Partner **API keys** ("AKIA…") — a dead end for its audience — and leaks "stored securely in Supabase" implementation detail.
- **Notes:** fine structurally; empty-pane icon is harsh black; only page without any bulk affordances — low priority.
- **Profile & History:** "coming soon" stubs reachable in prod nav paths. Ship or remove routes; Settings already covers profile actions.
- **Settings:** duplicate Edit Profile vs /profile stub; theme picker solid.
- **Onboarding:** honest 6-step flow, but: emoji hero icons, gradient gold→black CTAs, "Skip for now" still offered on the *completion* screen, step-count vs URL drift (A9), suggestion dedup (A10).
- **Login/Signup:** inconsistent pair — placeholders-only vs labeled fields, centered vs top-anchored card, three brand spellings; "Continue with Google" ignores Google branding guidelines (no G logo, brand-brown fill); signup lacks password requirements and a Terms/Privacy consent line even though the legal pages now exist.
- **Mobile (global):** "Ask me anything" FAB overlaps widget content on dashboard; bottom tab bar + long pages need scroll-padding; stat-card rows are full-screen-height speed bumps on every page.

---

## Milestones

1. **M1 — Broken things (bugs users hit daily).** Fix A1 (nonce on both inline scripts), A2 (migration: `value int → numeric` + regression test posting 122.6), A3 (decode entities once at the API/mapper layer), A5, A6, A7. Verify: console-error capture across all pages is clean; weight log persists end-to-end; budget button renders intact.
   - Stop condition: any fix requires touching the live Supabase dashboard → write the migration, hand SQL to the user.
2. **M2 — Dead weight and truth.** Remove /profile + /history stubs (or gate behind flags), delete fake social proof + pricing decision (ask user: real pricing vs remove section), fix A9/A10/A11, merge Board/Kanban into one view, hide Assignee until household ships. Verify: no route renders "coming soon"; landing contains no unverifiable claims.
3. **M3 — Information architecture.** One bucket-management surface (retire Folders page or make it *the* one, removing dashboard-tab management overlap); bucket tab overflow (scroll + "more" menu, cap visible tabs); replace header Sign out with a user menu (profile, settings, theme, sign out); reconcile email badge counts. Verify: taxonomy editable from exactly one place; every nav slot earns its page.
4. **M4 — Page-level layout fixes.** Dashboard: replace widget-meta stats with a today-summary (due tasks, next event, habit streak) and demote the greeting; Tasks: real dates on overdue ("Jul 2 · 14d"), group by due date, mobile shows due date not Status; Calendar: desktop default Week/Agenda, collapse empty agenda days, de-duplicate date header, move habits panel out or label it honestly; Budget: first-run wizard replaces 15 "Set budget" rows, Health Score hidden until data exists; Shopping: drop stat row; mobile FAB no longer overlaps content. Verify: `/verify-ui-change` per page (both themes, 390px).
5. **M5 — Design-system sweep.** Kill black CTAs and gradient-to-black buttons (brand tokens), replace emoji integration icons with logos, styled select component, one brand name everywhere, Google-compliant OAuth button, unified login/signup layout + terms consent line, landing scroll-reveal gets no-JS fallback (A8). Verify: grep gate for `bg-black`/raw hex in changed files; screenshot diff pass.

Suggested sequencing: M1 alone (one session), M2+M3 (one session), M4 per-page (one page per session), M5 sweep last.

## Test and verification strategy

- **Regression:** route test for A2 (posts fractional value); mapper test for A3; keep the audit script as `scripts/ux-audit/` or scratchpad — it mints an authed session via Supabase admin `generateLink` + `verifyOtp` through an `@supabase/ssr` recording cookie adapter, then screenshots all routes desktop+mobile with console capture.
- **Visual:** every M4/M5 change goes through `/verify-ui-change` (both themes, 390px). Re-run the full audit after each milestone; the console-errors JSON must stay empty.
- **Behavioral checks:** weight log survives reload; service worker registers (Application tab); custom theme loads without flash; ICS event times match the .ics source.

## Rollout and operations

- Everything ships behind normal deploys; A2 is the only migration (additive type widen — safe, reversible by re-narrowing only if no fractional rows exist).
- Failure signal: Sentry (`handleApiError`) volume on `/api/widgets/progress` should drop to zero after M1.
- Pricing/social-proof removal is content-only — reversible.

## Progress

- [x] 2026-07-16 — Full-app audit complete (34 screenshots, console traces, 11 root-caused defects). This plan.
- [ ] M1 bug fixes
- [ ] M2 dead weight + truth
- [ ] M3 IA consolidation
- [ ] M4 page layouts
- [ ] M5 design-system sweep

## Discoveries and plan changes

- 2026-07-16 — Port 3000/3001 were held by another live Claude session's dev servers (`nanobananamask` project); audit ran against this project on :3002. The first screenshot pass silently captured the *wrong app* (only `/` existed; all else 404) — identical-byte-size screenshots were the tell.
- 2026-07-16 — Dark mode is a color-theme swap (no Tailwind `dark:` class); "both themes" verification means checking at least one dark preset via Settings, not `prefers-color-scheme`.

## Residual risks and follow-ups

- **Required before completion:** user decisions on (a) pricing section: real or removed; (b) Folders page: retire vs promote; (c) Amazon integration: keep as power-user feature with honest copy, or shelve.
- **Deliberately deferred:** Trends detail page review (needs live widget instance); email feature-depth questions (AI tools scope); household/assignee feature design; Electron surfaces.
