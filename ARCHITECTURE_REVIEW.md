# Architecture Review: LifeboardAI

> Generated 2026-03-05 — Full codebase analysis with recommendations for a rebuild or incremental refactor.

## Overview

LifeboardAI is an emotion-first personal life dashboard built with **Next.js 14 (App Router)**, **Supabase** (auth + Postgres), **TanStack Query**, **Tailwind CSS**, and **Radix UI**. It integrates with Todoist, Withings, Fitbit, Google Fit, Google Calendar, FatSecret, and OpenAI. ~274 TS/TSX files, ~64K lines of code.

---

## Key Findings

### 1. God Component: `taskboard-dashboard.tsx` (3,987 lines)

The central dashboard component handles bucket management, widget rendering, drag-and-drop, task CRUD orchestration, modal state for 14+ widget types, settings, logs, undo, greeting/weather, and chat integration.

**Recommendation:** Break into ~8-10 focused components:
- `DashboardShell` — layout skeleton, tab navigation
- `BucketManager` — bucket CRUD, reorder, color
- `WidgetGrid` — widget rendering + drag-drop
- `WidgetModalOrchestrator` — single entry point for all widget modals
- `DashboardHeader` — greeting, weather, date
- `TasksSection` — embedded task list
- Use Zustand or lean context for shared state coordination

### 2. Competing Data-Fetching Paradigms

TanStack Query coexists with module-level singleton caches (`_authCache`, `_todoistConnected`, `_occurrenceExceptionsCache`, `_preferencesCache`) that have manual TTLs. These bypass React Query's invalidation, leading to stale data risks.

**Recommendation:** Standardize on TanStack Query as the sole caching layer. Use `queryClient.prefetchQuery()` and `queryClient.setQueryData()` instead of module-level caches.

### 3. Dual Drag-and-Drop Libraries

Both `@dnd-kit` and `@hello-pangea/dnd` are installed (~40KB+ redundant bundle).

**Recommendation:** Consolidate on `@dnd-kit` and remove `@hello-pangea/dnd`.

### 4. No Database Schema / Migrations Strategy

All user data lives in a single `user_preferences` row as JSON blobs. No migration framework (raw SQL files + admin API routes instead).

**Recommendation:** Use Supabase migrations or Drizzle ORM. Normalize into separate tables: `widgets`, `widget_progress`, `mood_entries`, `tasks`.

### 5. API Route Sprawl (~50+ routes)

Inconsistent auth patterns, non-RESTful task CRUD split across many routes, duplicated Todoist endpoints.

**Recommendation:** Use `withAuth` universally. RESTful routes: `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/[id]`. Merge task sources behind a unified service.

### 6. Minimal Test Coverage

Only 4 test files across 274 source files despite Jest + Playwright being configured.

**Recommendation:** Prioritize integration tests for API routes and the `useTasks` hook. Set CI coverage thresholds.

### 7. Kitchen-Sink Widget Type

`WidgetInstance` has optional fields for every widget type (`birthdayData`, `eventData`, `moodData`, etc.) growing unboundedly.

**Recommendation:** Use discriminated unions: `type WidgetInstance = MoodWidget | BirthdayWidget | ...` with per-type Zod schemas.

### 8. Under-utilized Server Components

Almost everything is `"use client"` with `ssr: false`. The App Router's server component capabilities are barely leveraged.

**Recommendation:** Fetch initial data in Server Components, pass as props. Only interactive parts need client components. Eliminates loading-spinner waterfalls.

### 9. Oversized Hook: `use-tasks.ts` (1,409 lines)

Handles Supabase CRUD, Todoist sync, occurrence exceptions, optimistic updates, batch operations, and retry logic in a single hook.

**Recommendation:** Split into `useSupabaseTasks`, `useTodoistTasks`, `useOccurrenceExceptions`. Create a `TaskService` class for API calls. Use TanStack Query's built-in optimistic update pattern.

### 10. Inconsistent Input Validation

Zod and `parseBody` exist but many routes use raw `req.json()` without validation.

**Recommendation:** Validate all API inputs with Zod schemas co-located with route files.

---

## Priority Matrix

| Priority | Change | Impact |
|----------|--------|--------|
| 1 | Break up `taskboard-dashboard.tsx` | Maintainability, developer velocity |
| 2 | Normalize DB schema (separate tables) | Query performance, data integrity |
| 3 | Consolidate caching on TanStack Query | Eliminate stale data bugs |
| 4 | Remove duplicate drag-drop library | Bundle size (-40KB) |
| 5 | Split `use-tasks.ts` into focused hooks | Testability, readability |
| 6 | Leverage Server Components for data fetching | First-paint performance |
| 7 | Add Zod validation to all API routes | Security, reliability |
| 8 | Add test coverage for critical paths | Confidence in changes |
| 9 | RESTful API route consolidation | Developer experience |
| 10 | Discriminated union for widget types | Type safety |

---

## What's Working Well

- Security headers in `next.config.js` (HSTS, X-Frame-Options, CSP-adjacent)
- Sentry integration with source maps + tunnel route
- `withAuth` wrapper pattern for API routes
- Radix UI for accessible primitives
- TanStack Query (where used consistently)
- Feature-based directory structure (`src/features/*`)
- Dynamic imports for code splitting heavy components
- Prefetching strategy in dashboard page client
- Zod available for validation (needs broader adoption)
- `optimizePackageImports` in Next config for tree-shaking
