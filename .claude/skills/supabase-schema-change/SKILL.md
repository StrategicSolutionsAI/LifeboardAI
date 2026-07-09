---
name: supabase-schema-change
description: Workflow for any change touching the Supabase schema — new tables/columns, triggers, RLS, or debugging errors that smell like schema drift (PostgREST error codes, NOT NULL violations, 400s on save).
---

# Supabase schema change

The two worst incidents in this repo were caused by DB objects created in the Supabase dashboard with no matching migration file. This workflow prevents a repeat.

## Making a schema change
1. Write the SQL as a new file in `supabase/migrations/` named `YYYYMMDD_<what-it-does>.sql`. One concern per file.
2. In the same change set, update the affected repository module in `src/repositories/`: the `*_SELECT_COLUMNS` constant and the `mapRowToX()` mapper (snake_case DB → camelCase app).
3. Update the TypeScript types in `src/types/`.
4. Present the SQL to the user to run in the Supabase dashboard SQL Editor — do not execute destructive SQL (DROP, DELETE, ALTER on live tables) yourself.
5. Add or update the route test under the nearest `__tests__/` covering the new shape.

## Debugging a suspected schema problem
1. Reproduce and capture the exact Supabase error object — `code` and `message` (e.g. `23502` NOT NULL violation, `PGRST116` not-found).
2. Before touching application code, diff live reality against `supabase/migrations/` on disk. Triggers and functions created in the dashboard won't appear in the repo — list them with `select * from pg_trigger` / `pg_proc` queries.
3. If drift is found: the fix is a migration file that reconciles it (even if the action is dropping the stray object), not a code workaround.
4. Verify via a schema-check endpoint (`src/app/api/admin/check-schema/route.ts` is the existing pattern) and re-run the failing save.

## Never
- `select('*')` in new repository code.
- A schema change in a PR without its migration file.
- Silently disabling a trigger/constraint without a note in the migration explaining what functionality is lost.
