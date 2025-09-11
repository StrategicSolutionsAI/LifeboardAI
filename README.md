# LifeboardAI

LifeboardAI is a personal dashboard built with Next.js and Supabase that unifies tasks, health metrics, nutrition, and calendar into a single, customizable command center.

## Features
- Unified task board with Todoist integration: daily/open/upcoming views, drag-and-drop, hourly planner.
- Health metrics: Withings (weight), Google Fit (steps/water), groundwork for Fitbit.
- Nutrition: FatSecret search and meal tracking scaffolding.
- Calendar: Google Calendar events display.
- User preferences persisted in Supabase: life buckets, widgets, progress history, hourly plan.
- Logging + error handling utilities integrated with Sentry.

## Quick Start
1) Install dependencies
   - `npm install`

2) Configure environment
   - Copy `.env.example` to `.env.local` and fill in:
     - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY` (server-only; do not expose client-side)
     - OAuth credentials for Todoist, Withings, Google, and FatSecret
     - `NEXT_PUBLIC_SITE_URL` (e.g., http://localhost:3000)

3) Database setup (Supabase)
   - Apply SQL migrations in `supabase/migrations/` (via Supabase CLI or dashboard SQL editor). These create:
     - `user_integrations`, `user_preferences`, `widget_progress_history`, `weight_measurements`
     - Additional columns like `provider_user_id` and JSONB preference fields
     - `lifeboard_tasks` (local task storage) with RLS policies for users without Todoist

4) Run the app
   - `npm run dev`
   - Visit `http://localhost:3000`

## Integrations
- Each OAuth handler resides under `src/app/api/auth/*`. Tokens are stored in `public.user_integrations` under RLS.
- Withings metrics endpoint handles token refresh and retries; webhook support expects `provider_user_id` to map notifications to users.

### Tasks without Todoist
- If Todoist isn’t connected, tasks are stored in Supabase in `public.lifeboard_tasks` via the following API routes:
  - `GET /api/tasks?date=YYYY-MM-DD` — daily tasks
  - `GET /api/tasks?all=true` — all open tasks
  - `POST /api/tasks` — create a task
  - `POST /api/tasks/batch-update` — batch update fields (due, hourSlot, bucket, position, duration, completed)
  - `POST /api/tasks/complete` and `POST /api/tasks/reopen`
  - `DELETE /api/tasks/delete`
- Chat/voice routes will also fall back to this storage when Todoist is not connected.

## Notes
- Keep secrets server-side only. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Error handling: prefer `withErrorHandling` and the `logger` for consistent diagnostics.
