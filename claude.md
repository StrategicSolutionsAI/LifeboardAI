# LifeboardAI — Operating Manual

Personal life-dashboard: Next.js 14 App Router + Supabase (auth/DB) + Electron desktop build. Tasks, calendar, habits, budget, notes, email, and health integrations (Todoist, Gmail, Google Calendar, Withings, Fitbit, Google Fit, FatSecret), organized into user-customizable buckets/widgets.

## Commands
- `npm run dev` — dev server on port 3000 (see dev-server rules below)
- `npx tsc --noEmit` — required after every change; do not rationalize away type errors
- `npm run build` — required for significant changes (catches prerender/bundling issues)
- `npm run test` (Jest, colocated `__tests__/`), `npm run test:e2e` (Playwright, `tests/`), `npm run test:all` before proposing a merge
- Commits: Conventional Commits scoped by domain — `fix(calendar): …`, `feat(tasks): …`

## 1. Think before coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State your assumptions explicitly. If uncertain, ask — before implementing,
  not after mistakes.
- If multiple interpretations exist, present them; don't pick one silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop, name what's confusing, and ask.
- Read before you write: review the exports, callers, and existing utilities
  around the code you're about to touch.

## 2. Simplicity first

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code; no "flexibility" or "configurability"
  that wasn't requested.
- No error handling for impossible scenarios — no over-defensive code.
- If you write 200 lines and it could be 50, rewrite it.
- Prefer the standard library and existing dependencies; ask before adding
  new ones.
- Test: would a senior engineer call this overcomplicated? If yes, simplify.

## 3. Surgical changes

Touch only what you must. Clean up only your own mess.

- Every changed line should trace directly to the user's request.
- Don't "improve" adjacent code, comments, or formatting; don't refactor
  things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Do remove imports, variables, and functions that YOUR changes made unused.
- Keep diffs small and reviewable; one logical change per commit, imperative
  mood in the message.

## 4. Goal-driven execution

Define success criteria, then loop until verified. Don't just follow steps.

- Transform tasks into verifiable goals:
  - "Add validation" → write tests for invalid inputs, then make them pass.
  - "Fix the bug" → write a test that reproduces it, then make it pass.
  - "Refactor X" → ensure tests pass before and after.
- For multi-step tasks, state a brief plan where each step has a check:
  `1. [step] → verify: [check]`
- Verify changes by running them, not just by reading the code.
- Fail loud: surface uncertainty and failures explicitly; never present
  unverified work as done.
- After each significant step, summarize what's verified and what remains.

## Boundaries

- IMPORTANT: Never run destructive commands (`rm -rf`, force-push, dropping
  database tables) without explicit confirmation.
- Never commit secrets, credentials, or `.env` files.
- Do not create documentation files unless explicitly requested.

## Gotchas

- Iridescent (`--iri-*`) tokens may appear in exactly five places (retrofit §3);
  do not add more. `[BRACKETED]` placeholders must stay visibly unfinished —
  never invent prices, clients, metrics, or quotes.
- Reveal styles hide content only under `html.js`; keep the `anim-fallback`
  safety classes intact or a JS failure blanks the page.
- Exactly one pinned scene (§5.5 process). Don't pin anything else.

---

### Maintaining this file

- **This is context engineering.** The core skill is filling the context
  window with just the right information — no more. Keep this file under
  ~80 lines of real content; a bloated CLAUDE.md gets ignored.
- **Treat it like a prompt, not documentation.** Iterate on wording when
  Claude misbehaves — add an emphatic `IMPORTANT:` to rules it skips.
- **Update it when you correct Claude twice for the same thing.** A repeated
  correction is a missing line in this file.
- **Prune aggressively.** Delete rules the codebase now enforces via linters,
  types, or CI — automation beats instruction.
- **It's working if:** diffs contain fewer unnecessary changes, fewer rewrites
  are needed due to overcomplication, and clarifying questions come before
  implementation rather than after mistakes.



## Conventions (follow these; the code already does)
- **Data access goes through `src/repositories/`**: explicit `*_SELECT_COLUMNS` constants and `mapRowToX()` snake_case→camelCase mappers. Never `select('*')` in new code; never let raw Supabase rows leak past the repository layer.
- **API routes** (`src/app/api/*/route.ts`): wrap handlers with `withErrorHandling`, throw `createApiError(message, status, code)`, auth-check via `supabaseServer().auth.getUser()` first. Rate limiting via `src/lib/rate-limit.ts` on expensive/external routes.
- **Styling is a 3-layer token system** (see STYLE_GUIDE.md): CSS variables → Tailwind `theme-*` classes → composed tokens in `src/lib/styles.ts`. Import `card`, `text`, `surface`, `form` from `@/lib/styles` and compose with `cn()`. Brand primary is **#B1916A warm golden brown — not purple**. Never hardcode hex values or raw Tailwind palette colors (`bg-amber-500`) in components.
- Feature code lives in `src/features/<domain>/` (tasks, calendar, dashboard, folders, widgets); shared UI in `src/components/`; cross-cutting logic in `src/lib/`. Files kebab-case, components PascalCase, hooks `use*`, named exports.
- Server Components by default; `use client` only where interaction demands it.
- External integrations each get a folder in `src/lib/<service>/`; credentials only via env vars; errors through `integration-error-handler.ts`.

## Mistakes a weaker model will make here — named, with the rule that prevents each
1. **Schema drift.** The worst outages in this repo (broken `user_preferences_history` trigger, stale-`end_date` calendar bug) came from DB objects created directly in the Supabase dashboard with no migration file. Rule: every schema change is a file in `supabase/migrations/` in the same PR as the code that depends on it. If behavior contradicts the migrations on disk, suspect dashboard drift first — check the live schema before debugging application code.
2. **Dev-server thrash.** Rule: never restart the dev server unless asked; never start a second instance; never switch ports. If 3000 is occupied, find out why (`lsof -ti:3000`) instead of moving.
3. **Declaring UI done without looking at it.** Rule: no UI task is complete without visual verification in the browser. If auth blocks you from the page, say so explicitly instead of silently skipping.
4. **Scattering new buttons.** Rule: new actions go into an existing pattern (edit modal, popover, context menu) — find the closest existing example, name it, and match it. For UI changes, state the approach in 2–3 bullets (files, placement, pattern followed) before writing code.
5. **Surface-level performance fixes.** Rule: measure first (module count, compile time, bundle size), name the bottleneck, then change code. Existing machinery: TTL caches (`cache-config.ts`), prefetchers (`prefetch-*.ts`), virtual scrolling, debounced saves — extend these, don't invent parallel ones.
6. **Deleting "unused" code.** Rule: grep the whole project for references before removing any import, function, or variable — widgets and buckets wire up dynamically. For audits, `npx knip` (config in `knip.json`) finds candidates but grep grants permission; encode intentional keeps in `knip.json` or `/** @public */` tags, never delete straight from the report (see docs/learnings/2026-07-07-dead-code-audit-knip.md).
7. **Editing outside the repo.** Rule: confirm every path starts with this project root before editing.
8. **Misclassifying OAuth errors as "token expired".** An integration that keeps disconnecting usually means our own error handler wiped tokens after mislabeling a provider error as permanent (Withings 2554 incident, docs/learnings/2026-07-09). Rule: check the DB row for NULL tokens first, and never map a provider status code to token-expired without reproducing that code against the live API with a deliberately invalid token.
9. **Server/client date drift.** All YYYY-MM-DD keys are CLIENT-local (`dateStr` in `src/lib/date-utils.ts` — the only implementation). Rule: server routes never derive "today" themselves — accept a `date`/`end` param from the client; never key data with `toISOString().slice(0, 10)` (docs/learnings/2026-07-09-local-date-half-migration.md).
10. **String-matched contracts.** Rule: cross-module behavior (session expiry → login redirect) rides on machine-readable markers — every app-session 401 sets the `x-session-expired` header from `src/lib/session-expired.ts`; never match on error-message text (docs/learnings/2026-07-09-session-expiry-header-marker.md).
11. **Auth-gate collateral.** The middleware matcher must exempt anything fetched without cookies (PWA assets, robots/sitemap, metadata routes) — a new public page or asset that 307s to /login for crawlers means it's missing from `src/middleware.ts`'s matcher or `PUBLIC_PATHS` (docs/learnings/2026-07-09-middleware-auth-gate-public-assets.md).
12. **Static pages under the nonce CSP.** The middleware mints a per-request nonce CSP, so every HTML route must render dynamically (`force-dynamic` in the root layout enforces this). A statically prerendered page ships nonce-less inline scripts, the browser blocks them all, and the page renders but never hydrates — invisible in dev, fatal in production builds (docs/learnings/2026-07-09-csp-nonce-requires-dynamic-rendering.md).
13. **Icon-library namespace imports.** `import * as Icons from 'lucide-react'` defeats tree-shaking (+150 kB route JS, found on /budget). Rule: named imports only; for icon-by-name lookups build an explicit map of the allowed names (pattern: `src/app/(app)/budget/components/category-icons.ts`).
14. **Opacity utilities on theme colors.** `bg-opacity-*`/`text-opacity-*` are silent no-ops on `theme-*` colors (they're plain CSS-var hex, no alpha slot) — `bg-theme-primary bg-opacity-10` renders a solid brand block with invisible text (onboarding chips incident). Rule: use `theme-brand-tint-*` tokens for translucent brand surfaces (docs/learnings/2026-07-09-bg-opacity-css-var-colors.md).
15. **Not-connected treated as an error.** Read-only integration routes must answer 200 with empty data + `connected: false` when the provider simply isn't linked — a 4xx there floods every unconnected user's console and hides real failures (pattern: `todoist/tasks`, `google/calendar/events`, `email/unread-count`).
16. **Parsing model output for actions.** Voice actions are native Realtime GA tool calls executed via `/api/chat/execute-command` — never regex the transcript or ask the model to emit command blocks, and never mix beta Realtime endpoints/headers with the GA shape (docs/learnings/2026-07-09-realtime-ga-native-tools.md).

## Quality bar per deliverable (checkable, not adjectives)
- **Bug fix:** root cause named in the commit body; regression test added next to the code; `tsc --noEmit` clean; the failing scenario re-run and shown passing.
- **Feature:** repository-layer data access; tokens from `styles.ts` (zero hardcoded colors); loading skeleton for any async view; works in light and dark mode; `npm run build` passes; screenshot of the working UI.
- **API route:** auth check, body validation, `createApiError` for every failure path, and a `__tests__/route.test.ts` covering 401 + invalid body + happy path.
- **Schema change:** migration file + updated repository mappers + a note in the PR on how to verify (`/api/admin/check-schema` pattern).

## When uncertain — exact escalation rules
- Can't verify visually (auth wall, missing env) → say so and stop; don't claim done.
- A fix requires touching the live Supabase dashboard → write the migration, present the SQL, let the user run it. Never execute destructive SQL yourself.
- Two existing patterns conflict → follow the one in `src/features/`, and flag the inconsistency rather than inventing a third.
- Task is ambiguous about scope → one deliverable per session; implement first, polish second; list follow-ups instead of doing them.
