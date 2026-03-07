# LifeboardAI

LifeboardAI is a personal dashboard built with Next.js and Supabase that unifies tasks, health metrics, nutrition, shopping, and calendar into a single, customizable command center.

## Features

- **Task Board**: Daily/open/upcoming views, drag-and-drop Kanban, hourly planner, family member assignment. Supports Todoist sync or local Supabase-backed tasks.
- **AI Chatbot**: Text and voice chat with context-aware responses (tasks, calendar, shopping). Powered by Gemini 3.1 Pro with OpenAI fallback.
- **Calendar**: Google Calendar event display and planning.
- **Shopping List**: Dedicated shopping list management with Amazon integration.
- **Health Metrics**: Withings (weight), Google Fit (steps/water), Fitbit integration.
- **Nutrition**: FatSecret food search and meal tracking.
- **Family Members**: Assign tasks to family members with avatar display on board and Kanban cards.
- **Trends & History**: Analytics views and activity history.
- **Customizable Dashboard**: Life buckets (tabs) with draggable widgets, progress tracking, and widget preferences persisted in Supabase.
- **Logging & Error Handling**: Sentry integration with structured error handling utilities.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; do not expose client-side)
   - OAuth credentials for Todoist, Withings, Google, Google Fit, Fitbit, Amazon, FatSecret
   - `REPLICATE_API_TOKEN` (for Gemini chatbot)
   - `OPENAI_API_KEY` (for chatbot fallback and voice TTS)
   - `NEXT_PUBLIC_SITE_URL` (e.g., `http://localhost:3000`)

3. **Database setup (Supabase)**
   Apply SQL migrations in `supabase/migrations/` via the Supabase CLI or dashboard SQL editor.

4. **Run the app**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run test` | Run tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run type-check` | TypeScript validation |

## Integrations

Each OAuth handler resides under `src/app/api/auth/*`. Tokens are stored in `public.user_integrations` under RLS.

| Provider | Data |
|----------|------|
| Todoist | Task sync (create, update, complete, reorder) |
| Google Calendar | Calendar events |
| Google Fit | Steps, water intake |
| Withings | Weight measurements, webhook support |
| Fitbit | Fitness tracking |
| Amazon | Shopping lists |
| FatSecret | Food search and nutrition data |

### Tasks without Todoist

If Todoist isn't connected, tasks are stored in Supabase via `public.lifeboard_tasks`:
- `GET /api/tasks?date=YYYY-MM-DD` — daily tasks
- `GET /api/tasks?all=true` — all open tasks
- `POST /api/tasks` — create a task
- `POST /api/tasks/batch-update` — batch update fields
- `POST /api/tasks/complete` and `POST /api/tasks/reopen`
- `DELETE /api/tasks/delete`

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: Shadcn UI, Tailwind CSS, Framer Motion
- **Backend**: Supabase (Auth, PostgreSQL, RLS)
- **AI**: Gemini 3.1 Pro (Replicate), OpenAI GPT-4o-mini (fallback), OpenAI Realtime API (voice)

## Notes

- Keep secrets server-side only. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Error handling: use `handleApiError` and the `logger` for consistent diagnostics.
