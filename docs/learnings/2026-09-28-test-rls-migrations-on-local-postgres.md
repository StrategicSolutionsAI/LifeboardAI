# Test RLS migrations on a throwaway local Postgres before handing over the SQL

**Problem** — Every `/api/household` request returned 500; the family widget quietly showed no household and invites "succeeded" without ever working.

**Approach**
1. The live-schema read with the service key was (rightly) blocked, so the migrations on disk were the only evidence. Instead of reasoning about them, they were *executed*: `initdb` a cluster in the scratchpad, start it on TCP only (`-k '' -c listen_addresses=127.0.0.1`; the scratchpad path is too long for a Unix socket), and add a Supabase shim — roles `anon`/`authenticated`/`service_role`, `auth.users`, `auth.uid()` reading `current_setting('request.jwt.claim.sub')`, `auth.jwt()` reading `request.jwt.claims`, and Supabase's default grants.
2. Applying every migration in order surfaced two facts at once: `20260306_create_households_tables.sql` fails on a fresh database (its first policy references `household_members` before creating it), and with the tables forced into existence, `select … from household_members` as `authenticated` raises **42P17 infinite recursion** — the SELECT policy sub-selected its own table.
3. A normal authenticated request from the running app returned the same 42P17 body, confirming the live DB matched.
4. The fix migration was run against two starting states (half-applied, fully applied with old policies), twice each for idempotency, then a scenario script of `DO $$ … assert … $$` blocks switched users with `set_config(...)` + `set role authenticated` and checked sharing, outsider isolation, invites, leave, and budget merge.

**Solution** — `supabase/migrations/20260928_household_sharing.sql`: membership helpers `my_household_ids()` / `my_admin_household_ids()` as `SECURITY DEFINER … set search_path = ''`; every policy calls them instead of sub-selecting `household_members`; tables recreated `if not exists`; all existing policies dropped by iterating `pg_policies` so dashboard-created names can't survive.

**Rule** — Before presenting any RLS/trigger migration, run it (and every earlier migration) on a local Postgres with the auth shim, from at least two starting states, and assert behaviour as two different users. A policy on table T must never sub-select T — route membership checks through a `SECURITY DEFINER` function. Drop policies by iterating `pg_policies`, not by guessed names.

**Dead ends** — Reading the policy SQL and concluding it "looks fine" (the recursion only appears when a non-superuser evaluates it; `postgres` bypasses RLS). Using the service-role key to probe live — it bypasses RLS too, so it could not have shown the bug even if allowed.
