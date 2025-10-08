# Repository Guidelines

## Project Structure & Module Organization
`src/app` hosts Next.js routes, API handlers, and server actions. Shared UI lives in `src/components`, while cross-cutting logic is grouped in `src/lib`, `src/hooks`, `src/contexts`, and `src/utils`. Static assets reside in `public`. Supabase SQL migrations belong in `supabase/migrations`, and Playwright artifacts land under `playwright-report`. Keep ad-hoc scripts in `scripts/` and monitoring helpers (such as `instrumentation.ts`) in the repo root.

## Build, Test, and Development Commands
Run `npm run dev` for the local dev server, `npm run build` to generate the production bundle, and `npm run start` to serve it. Quality checks include `npm run lint` for ESLint, `npm run type-check` for TypeScript, and `npm run security:audit` for npm advisories. Use `npm run test` for Jest suites, `npm run test:e2e` for Playwright headless runs, and `npm run test:all` before proposing a merge.

## Coding Style & Naming Conventions
Follow the patterns in `LIFEBOARD_AI_STYLE_GUIDE.md` and Tailwind utility classes for styling. Components and contexts use PascalCase, hooks start with `use`, and helpers remain camelCase. Prefer composition over deep prop drilling, and add focused comments only where logic is non-obvious. ESLint enforces 2-space indentation and import ordering via `npm run lint`.

## Testing Guidelines
Jest unit and integration tests live alongside code in `__tests__` folders (e.g., `src/app/api/.../__tests__/route.test.ts`). End-to-end scenarios belong in `tests/` and use Playwright fixtures. Mirror bug fixes with regressions tests, aim for meaningful coverage reporting via `npm run test:coverage`, and name test files with `.test.ts` or `.spec.ts` endings. Update mocks in `tests/fixtures` when backend contracts change.

## Commit & Pull Request Guidelines
Use Conventional Commits (`feat:`, `fix:`, `chore:`, etc.) and scope them by domain when possible (`feat(tasks): ...`). Each PR should link related Linear/Jira issues, summarize functional impact, and include screenshots or Looms for UI changes. Note which commands were run (lint, tests, e2e) in the description, request review from domain owners, and ensure `SECURITY.md` or other docs are updated when policies shift.

## Security & Configuration Tips
Copy `.env.example` to `.env.local` and keep secrets out of version control. Coordinate Supabase schema updates by pairing code changes with matching migration files and documenting them in the PR. When integrating third-party APIs, route credentials through environment variables and add usage notes to `SECURITY.md`.
