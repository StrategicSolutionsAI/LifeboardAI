# CLAUDE.md — LifeboardAI

## Project Overview

LifeboardAI is a personal dashboard application that unifies tasks, health metrics, nutrition, calendar, and shopping lists into a single customizable command center. Users organize content via "buckets" (tabs) containing configurable widgets.

## Tech Stack

- **Framework**: Next.js 14.x (App Router)
- **Language**: TypeScript (strict mode)
- **UI**: Shadcn UI + Radix primitives, Tailwind CSS, Framer Motion
- **Backend/Auth**: Supabase (PostgreSQL, Auth, RLS)
- **State**: React Query (`@tanstack/react-query`), React Context
- **Drag & Drop**: `@dnd-kit/core` + `@hello-pangea/dnd`
- **Charts**: Recharts
- **Monitoring**: Sentry (error tracking), Vercel Analytics + Speed Insights
- **AI**: OpenAI (TTS fallback), Replicate (chatbot)
- **Testing**: Jest + React Testing Library (unit), Playwright (e2e)
- **Deployment**: Vercel (production deploys via GitHub Actions on `main`)

## Quick Start

```bash
npm install
cp .env.example .env.local   # Fill in required values
npm run dev                   # http://localhost:3000
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint (next/core-web-vitals + jsx-a11y) |
| `npm run type-check` | TypeScript check (`tsc --noEmit`) |
| `npm run test` | Jest unit/integration tests |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Jest with coverage report |
| `npm run test:e2e` | Playwright headless tests |
| `npm run test:all` | Jest + Playwright combined |
| `npm run security:audit` | npm audit (moderate+) |

## Project Structure

```
/
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   │   ├── (app)/              # Authenticated route group
│   │   │   ├── dashboard/      # Main dashboard page
│   │   │   ├── calendar/       # Calendar view
│   │   │   ├── tasks/          # Tasks view
│   │   │   ├── trends/         # Trends/analytics view
│   │   │   ├── history/        # History view
│   │   │   ├── profile/        # User profile
│   │   │   ├── integrations/   # Integration settings
│   │   │   ├── shopping-list/  # Shopping list
│   │   │   └── folders/        # Folders management
│   │   ├── api/                # API route handlers
│   │   │   ├── auth/           # OAuth handlers (Todoist, Withings, Google)
│   │   │   ├── tasks/          # Task CRUD + batch operations
│   │   │   ├── calendar/       # Calendar events
│   │   │   ├── chat/           # Chat/AI endpoints
│   │   │   ├── widgets/        # Widget management
│   │   │   ├── nutrition/      # FatSecret integration
│   │   │   ├── shopping-list/  # Shopping list API
│   │   │   └── webhooks/       # External webhooks
│   │   ├── login/              # Login page
│   │   ├── signup/             # Signup page
│   │   └── onboarding/         # 5-step onboarding flow
│   ├── components/             # Shared components
│   │   ├── ui/                 # Shadcn UI primitives (button, card, input, etc.)
│   │   ├── landing/            # Landing page components
│   │   ├── integrations/       # Integration UI components
│   │   ├── sidebar-layout.tsx  # Main app sidebar navigation
│   │   └── chat-bar.tsx        # Chat bar component
│   ├── features/               # Feature-specific modules
│   │   ├── tasks/components/   # Task-related components
│   │   ├── dashboard/          # Dashboard components + hooks
│   │   ├── calendar/           # Calendar components + hooks
│   │   ├── widgets/components/ # Widget components
│   │   └── folders/components/ # Folder components
│   ├── hooks/                  # Global custom hooks
│   │   ├── use-tasks.ts        # Task data management
│   │   ├── use-buckets.ts      # Bucket (tab) management
│   │   ├── use-widgets.ts      # Widget management
│   │   ├── use-data-cache.ts   # TTL-based data caching
│   │   └── use-*.ts            # Other domain hooks
│   ├── contexts/               # React contexts
│   │   └── tasks-context.tsx   # Tasks state context
│   ├── providers/              # Provider wrappers
│   │   └── query-provider.tsx  # React Query provider
│   ├── repositories/           # Data access layer
│   │   ├── tasks.ts            # Task repository
│   │   └── shopping-list.ts    # Shopping list repository
│   ├── lib/                    # Utilities & integrations
│   │   ├── logger.ts           # Logging utility (Sentry-integrated)
│   │   ├── api-error-handler.ts  # Centralized API error handling
│   │   ├── validations.ts      # Zod validation schemas
│   │   ├── utils.ts            # General utilities (cn, etc.)
│   │   ├── todoist/            # Todoist integration
│   │   ├── google/             # Google Calendar integration
│   │   ├── withings/           # Withings health integration
│   │   ├── fatsecret/          # FatSecret nutrition integration
│   │   ├── replicate/          # Replicate AI integration
│   │   ├── database/           # Database utilities
│   │   └── ...                 # Other utilities
│   ├── types/                  # TypeScript type definitions
│   │   ├── tasks.ts            # Task types
│   │   └── widgets.ts          # Widget types
│   └── utils/supabase/         # Supabase client utilities
│       ├── client.ts           # Browser Supabase client
│       ├── server.ts           # Server Supabase client
│       ├── middleware.ts        # Auth session refresh
│       └── bearer.ts           # Bearer token auth
├── supabase/migrations/        # SQL migration files
├── scripts/                    # Utility scripts (migrations, data fixes)
├── tests/                      # Playwright e2e tests
├── public/                     # Static assets
└── .claude/                    # Claude Code configuration
    └── settings.json           # Hooks (type-check on edit, dev server guard)
```

## Architecture Patterns

### Server vs Client Components
- **Default to Server Components** — use `'use client'` only when interactivity (hooks, event handlers, browser APIs) is required.
- API route handlers are in `src/app/api/` and use `NextRequest`/`NextResponse`.
- Middleware (`middleware.ts`) handles Supabase session refresh on page routes only.

### Data Flow
- **React Query** for server state (tasks, widgets, calendar events) via `@tanstack/react-query`.
- **React Context** for cross-component state (e.g., `TasksContext`).
- **Repository pattern** in `src/repositories/` for data access abstraction.
- **TTL-based caching** via `use-data-cache.ts` hook for performance.
- **Optimistic updates** for task mutations.

### Authentication
- Supabase Auth with Row-Level Security (RLS) on all tables.
- OAuth integrations for Todoist, Withings, Google Calendar.
- Session handled via `@supabase/ssr` middleware.
- Bearer token auth available for API routes (`src/utils/supabase/bearer.ts`).

### Path Aliases
- `@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Environment Variables

Required (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase connection
- `SUPABASE_SERVICE_ROLE_KEY` — Server-only admin access (never expose client-side)
- `NEXT_PUBLIC_SITE_URL` — App URL (default `http://localhost:3000`)

Optional integrations:
- `TODOIST_CLIENT_ID` / `TODOIST_CLIENT_SECRET` — Todoist OAuth
- `WITHINGS_CLIENT_ID` / `WITHINGS_CLIENT_SECRET` — Withings health data
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google Calendar
- `FATSECRET_CLIENT_ID` / `FATSECRET_CLIENT_SECRET` — Nutrition
- `OPENAI_API_KEY` — TTS fallback
- `REPLICATE_API_TOKEN` — AI chatbot
- `SENTRY_AUTH_TOKEN` / `SENTRY_DSN` — Error monitoring

## Database

- **Supabase PostgreSQL** with RLS policies per user.
- Migrations in `supabase/migrations/` — apply via Supabase CLI or SQL editor.
- Key tables: `user_integrations`, `user_preferences`, `lifeboard_tasks`, `widget_progress_history`, `weight_measurements`, `calendar_events`, `task_occurrence_exceptions`.
- Tasks API supports both Todoist-connected and local (`lifeboard_tasks`) storage.

## Code Conventions

### Naming
- **Components**: PascalCase (`TaskBoard.tsx`), files kebab-case (`task-board.tsx`)
- **Hooks**: `use-` prefix, camelCase (`use-tasks.ts`)
- **Variables**: descriptive with auxiliary verbs (`isLoading`, `hasError`, `canEdit`)
- **Types**: TypeScript `interface` preferred over `type` for object shapes

### Component Structure
- Functional components only (no classes)
- Named exports (not default)
- File order: exported component, subcomponents, helpers, static content, types

### Styling
- Tailwind CSS utility classes
- `cn()` helper from `src/lib/utils.ts` for conditional class merging
- Shadcn UI primitives in `src/components/ui/`

### Error Handling
- Use `withErrorHandling` wrapper and `logger` for consistent diagnostics
- `api-error-handler.ts` for centralized API error responses
- Zod schemas in `validations.ts` for input validation

## Hooks Configuration

The `.claude/settings.json` configures:
1. **PreToolUse (Bash)**: Blocks starting a dev server if one is already running on ports 3000-3002.
2. **PostToolUse (Edit/Write)**: Automatically runs `tsc --noEmit` after file edits to catch type errors immediately.

## CI/CD

- **Production deploys**: GitHub Actions workflow (`.github/workflows/vercel-prod.yml`) triggers on push to `main`.
- Build and deploy via Vercel CLI with `--prod` flag.
- Node 18 in CI.

## Commit Conventions

Use Conventional Commits scoped by domain:
```
feat(tasks): add recurring task support
fix(calendar): correct timezone offset in event display
chore(deps): update @supabase/ssr to latest
```

## Key Rules for AI Assistants

### Before Coding
- Read files before modifying them — do not propose changes to unread code.
- For UI changes, describe the approach in 2-3 bullet points and wait for approval.
- Match existing patterns — find and reference the closest existing pattern in the codebase.

### While Coding
- Run `npm run type-check` (or rely on the PostToolUse hook) to catch type errors — fix them, don't rationalize them away.
- Run `npm run build` for significant changes to catch prerender/bundling issues.
- Check references before removing imports, functions, or variables — grep across the project.
- Keep changes minimal and focused — don't refactor surrounding code or add features beyond what's asked.

### Dev Server
- Do NOT restart the dev server unless explicitly asked.
- The app runs on port 3000. Don't switch ports — investigate why the current port is occupied.
- Never start a second dev server instance.

### Performance
- Identify bottlenecks before making surface-level changes — profile/measure first.
- Establish baselines (module count, compile time, bundle size) before and after changes.

### Testing
- Jest unit tests go alongside code in `__tests__` folders.
- Playwright e2e tests go in `tests/`.
- Coverage thresholds: 60% minimum (branches, functions, lines, statements).
- Run `npm run test:all` before proposing merges.

### Security
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Route all third-party credentials through environment variables.
- Keep secrets out of version control — use `.env.local`.
