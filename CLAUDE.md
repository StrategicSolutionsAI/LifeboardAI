# CLAUDE.md — LifeboardAI

> Quick-reference guide for Claude Code working in this repository.

## Tech Stack

- **Framework:** Next.js 14 (App Router) with TypeScript (strict mode)
- **UI:** Shadcn UI + Radix UI primitives, Tailwind CSS, Framer Motion
- **State:** React Context + TanStack React Query
- **Database:** Supabase (PostgreSQL with Row-Level Security)
- **Auth:** Supabase Auth (email, OAuth providers)
- **AI:** Gemini via Replicate (primary), OpenAI GPT-4o-mini (fallback), OpenAI Realtime for voice
- **Charts:** Recharts
- **Monitoring:** Sentry (client + server + edge), Vercel Analytics
- **Desktop:** Electron (optional builds)
- **Package manager:** npm

## Commands

```bash
npm run dev              # Start dev server (port 3000)
npm run build            # Production build
npm run lint             # ESLint (next/core-web-vitals + jsx-a11y)
npm run type-check       # tsc --noEmit
npm run test             # Jest unit tests
npm run test:watch       # Jest in watch mode
npm run test:coverage    # Jest with coverage (60% threshold)
npm run test:e2e         # Playwright (Chromium, Firefox, WebKit)
npm run test:all         # Jest + Playwright
npm run security:audit   # npm audit
```

## Project Structure

```
src/
├── app/                  # Next.js pages, layouts, API routes
│   ├── (app)/            # Authenticated routes (dashboard, calendar, tasks, etc.)
│   └── api/              # REST API endpoints (24+)
├── components/           # Shared UI components
├── features/             # Feature-specific logic (tasks, folders, dashboard, calendar, widgets)
├── hooks/                # Custom React hooks (17+)
├── contexts/             # React context providers
├── providers/            # State/context providers
├── repositories/         # Data access layer
├── lib/                  # Utilities, integration clients (Todoist, Google, Withings, etc.)
│   └── styles.ts         # Composed design tokens (import from here)
├── types/                # TypeScript type definitions
└── utils/                # General utilities, Supabase client helpers
supabase/migrations/      # 45+ SQL migration files
electron/                 # Electron main process
tests/                    # Playwright E2E tests
```

## Architecture

**Dashboard:** Customizable "life buckets" (tabs) containing tasks and widgets (40+ types).

**Task system:** Dual-source — Todoist sync or native Supabase storage. Tasks support due dates, recurring rules, kanban status, hourly time slots, and family member assignment.

**Widgets:** Habit tracker, weight, mood, sleep, meditation, water, and more. Each has its own data structure, progress history, and streak tracking.

**Data flow:** Supabase with RLS (users only see their own data) → API routes → React Query cache → React Context → components.

**Integrations:** Todoist, Google Calendar, Google Fit, Withings, Fitbit, FatSecret — all via OAuth with tokens stored in `user_integrations` table.

## Code Patterns

- **Functional components only** — no classes
- **Server Components by default** — `'use client'` only where needed
- **Named exports** for components
- **File naming:** lowercase-with-dashes (e.g., `task-board.tsx`)
- **File structure:** exported component → subcomponents → helpers → static content → types
- **Variable naming:** auxiliary verbs (e.g., `isLoading`, `hasError`, `canEdit`)
- **TypeScript interfaces** for type definitions (not `type` aliases for objects)
- **Path alias:** `@/*` maps to `src/*`

## Styling

Uses a 3-layer design system documented in `STYLE_GUIDE.md`:

```
CSS Variables (globals.css) → Tailwind Config → Composed Tokens (src/lib/styles.ts)
```

Always import tokens from `@/lib/styles` and compose with `cn()` from `@/lib/utils`:

```tsx
import { card, text, surface } from '@/lib/styles'
import { cn } from '@/lib/utils'

<div className={cn(card.base, 'p-4')}>
  <h2 className={cn(text.heading.lg, text.primary)}>Title</h2>
</div>
```

Brand color: warm earth tones (#B1916A primary). See `STYLE_GUIDE.md` for the full token reference.

## Database

- Migrations live in `supabase/migrations/` — always pair schema changes with a migration file
- All tables use RLS — users can only access their own data
- Key tables: `lifeboard_tasks`, `user_preferences`, `user_integrations`, `calendar_events`, `shopping_list_items`, `widget_progress_history`
- Copy `.env.example` to `.env.local` for required environment variables

## Testing

- **Unit tests:** Jest with jsdom, files in `__tests__/` folders alongside source (`.test.ts` or `.spec.ts`)
- **E2E tests:** Playwright in `tests/`, runs across Chromium/Firefox/WebKit
- **Coverage threshold:** 60% (branches, functions, lines, statements)
- **Mocks:** Update `tests/fixtures` when backend contracts change

## Hooks & Automation

A PostToolUse hook runs `npx tsc --noEmit` after every Edit/Write — type errors surface immediately. Fix them before proceeding.

A PreToolUse hook blocks starting a dev server if one is already running on ports 3000-3002.

## Rules

### Build & Verification
- After changes, type errors from the PostToolUse hook must be resolved — do not rationalize them away
- Run `npm run build` for significant changes to catch prerender and bundling issues
- If a build or dev server fails, investigate the root cause — don't switch ports or restart blindly

### Dev Server
- Do NOT start the dev server unless explicitly asked — use the existing one
- Never run a second instance alongside an existing one
- If restarting: `lsof -ti:3000 | xargs kill` first

### Editing
- Read files before editing — understand existing code first
- Check references before removing imports, functions, or variables (grep across project)
- Don't over-explore — front-load implementation over exploration

### UI Changes
- Describe approach in 2-3 bullet points and wait for approval before coding
- Match existing patterns — find the closest pattern in the codebase and follow it
- Consolidate into existing UI patterns (modals, popovers, context menus) rather than adding new surfaces
- No decorative emojis unless the user requests them
- Visual verification required — verify UI changes visually; if you can't, tell the user

### Performance
- Profile and measure before optimizing — identify the core bottleneck first
- Establish baselines (module count, compile time, bundle size) before and after changes

### Session Scope
- Focus on a single deliverable per session for large tasks
- Implement first, polish second
- Note follow-up work in conversation rather than attempting everything at once

## Related Docs

- `STYLE_GUIDE.md` — Full design token reference
- `SECURITY.md` — Security considerations
- `AGENTS.md` — Commit/PR guidelines and repository conventions
- `.env.example` — Required environment variables
