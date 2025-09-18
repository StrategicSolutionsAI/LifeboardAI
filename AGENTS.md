# Repository Guidelines

## Project Structure & Module Organization
LifeboardAI runs on the Next.js App Router inside `src/app`. Shared UI components live in `src/components`, state lives in `src/store`, hooks in `src/hooks`, and data/service utilities in `src/lib` and `src/utils`. React context providers reside in `src/contexts`. Static assets belong in `public/`, while Supabase SQL migrations sit in `supabase/migrations`. Jest unit suites stay close to features in `src/**/__tests__/`, and Playwright end-to-end specs live in `tests/`.

## Build, Test, and Development Commands
- `npm run dev`: start the live-reload development server.
- `npm run build`: compile the production bundle and run framework lint checks.
- `npm run start`: serve the optimized build locally.
- `npm run lint` / `npm run type-check`: enforce ESLint (`next/core-web-vitals`) and strict TypeScript.
- `npm run test`, `npm run test:coverage`: run Jest suites and verify coverage deltas before merging.
- `npm run test:e2e` or `npm run test:all`: execute Playwright flows; seed Supabase data first.

## Coding Style & Naming Conventions
Use TypeScript functional components and React hooks. Keep component files PascalCase (`WidgetLibrary.tsx`), hooks prefixed with `use`, and utilities camelCase. Prefer Tailwind utilities for styling and match tokens from `LIFEBOARD_AI_STYLE_GUIDE.md`. Group imports from external packages before absolute aliases (`@/...`). Centralize Supabase access through helpers in `src/lib` instead of ad hoc inline queries.

## Testing Guidelines
Follow Testing Library patterns configured in `jest.setup.js`; name files after their targets (`widget-library.test.tsx`) and mock Supabase with provided fixtures. For Playwright, store specs as `*.spec.ts` and reuse fixtures in `tests/` to cover taskboard drag-and-drop, widget dashboards, and API edge cases. Update snapshots only after reviewing against the design guide.

## Commit & Pull Request Guidelines
Commit subjects should be imperative and short; the history favors Conventional Commit prefixes (`feat(mobile-ux):`, `chore:`). Squash exploratory commits before pushing. Pull requests need a written change summary, verification checklist (`npm run test:all` when relevant), UI screenshots for visual updates, and links to the tracked issue. Keep secrets confined to `.env.local` and never commit credential files.

## Environment & Deployment Notes
Copy `.env.example` (or `.env.example.todoist`) into `.env.local` and populate Supabase and OAuth credentials before running dev servers or tests. Mirror schema updates in `supabase/migrations` so teammates and CI stay aligned. Production deploys flow through `.github/workflows/vercel-prod.yml`, which runs `npm ci`, `vercel build`, and `vercel deploy`; keep dependency upgrades well-tested before merging to `main`.
