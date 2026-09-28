-- ============================================================================
-- Household sharing
--
-- Until now no data table carried household_id, so two accounts in the same
-- household shared nothing. This migration makes calendar, tasks, shopping and
-- budget rows visible to every active member of the author's household.
--
--   * Helper functions (SECURITY DEFINER) answer "which households am I in",
--     so no policy ever sub-selects household_members under RLS. The original
--     hm_select_own_household policy did exactly that on its own table, which
--     Postgres rejects with 42P17 "infinite recursion detected in policy".
--   * A BEFORE INSERT trigger stamps household_id on every shared table, so
--     the app's many insert paths (routes, chat commands, calendar sync, cron)
--     need no change.
--   * Joining a household attaches the member's existing rows ("shared by
--     default"); leaving detaches the rows they authored. Budget categories a
--     joiner already had are merged by name into the household's, so the
--     shared budget does not list "Groceries" twice.
--   * Invites carry a token for a shareable link; acceptance goes through
--     accept_household_invite(), which replaces the hm_claim_pending_invite
--     policy (it read auth.users, which the authenticated role cannot select).
--   * households.family_roster holds the Family Members roster so assignees
--     and calendar colours resolve for every member, not just its author.
--
-- Health, email, notes and anything synced from Todoist live in other tables
-- and stay private.
--
-- Verify after running: see the queries at the bottom of this file.
-- ============================================================================

-- ── Household tables ────────────────────────────────────────────────────────
-- 20260306_create_households_tables.sql cannot run on a fresh database: its
-- first households policy references household_members before that table is
-- created. So these tables may be missing, or present without policies. Both
-- are created here idempotently with the same shape.

create table if not exists public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'My Household',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  user_id       uuid references auth.users (id) on delete set null,
  role          text not null default 'member' check (role in ('admin', 'member')),
  status        text not null default 'pending' check (status in ('pending', 'active')),
  invited_email text,
  display_name  text,
  invited_at    timestamptz not null default now(),
  joined_at     timestamptz,
  unique (household_id, invited_email)
);

create index if not exists idx_household_members_user_id on public.household_members (user_id);
create index if not exists idx_household_members_household_id on public.household_members (household_id);
create index if not exists idx_household_members_invited_email on public.household_members (invited_email);

alter table public.households add column if not exists family_roster jsonb not null default '[]'::jsonb;
alter table public.household_members add column if not exists invite_token uuid not null default gen_random_uuid();
create unique index if not exists household_members_invite_token_key on public.household_members (invite_token);

-- One active household per user (the API already assumed this).
create unique index if not exists household_members_one_active_per_user
  on public.household_members (user_id) where status = 'active';

-- ── Membership helpers ──────────────────────────────────────────────────────

create or replace function public.my_household_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select hm.household_id from public.household_members hm
  where hm.user_id = auth.uid() and hm.status = 'active'
$$;

create or replace function public.my_admin_household_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select hm.household_id from public.household_members hm
  where hm.user_id = auth.uid() and hm.status = 'active' and hm.role = 'admin'
$$;

create or replace function public.household_of(p_user uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select hm.household_id from public.household_members hm
  where hm.user_id = p_user and hm.status = 'active'
  limit 1
$$;

revoke execute on function public.household_of(uuid) from public, anon, authenticated;

-- ── households / household_members policies ─────────────────────────────────

do $$
declare
  p record;
begin
  alter table public.households enable row level security;
  alter table public.household_members enable row level security;
  for p in select tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in ('households', 'household_members') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy "household_select_member" on public.households for select
  using (id in (select public.my_household_ids()) or created_by = auth.uid());

-- Households are created through create_household(); this covers direct inserts.
create policy "household_insert_own" on public.households for insert
  with check (created_by = auth.uid());

-- Any member may update the household (name, shared roster); only the creator may delete it.
create policy "household_update_member" on public.households for update
  using (id in (select public.my_household_ids()))
  with check (id in (select public.my_household_ids()));

create policy "household_delete_creator" on public.households for delete
  using (created_by = auth.uid());

create policy "hm_select_household" on public.household_members for select
  using (household_id in (select public.my_household_ids()) or user_id = auth.uid());

-- Admins create pending invites; memberships become active only via the RPCs below.
create policy "hm_insert_admin" on public.household_members for insert
  with check (household_id in (select public.my_admin_household_ids()) and status = 'pending');

create policy "hm_update_admin" on public.household_members for update
  using (household_id in (select public.my_admin_household_ids()))
  with check (household_id in (select public.my_admin_household_ids()));

-- Admins remove anyone; a member may remove themselves (leave).
create policy "hm_delete_admin_or_self" on public.household_members for delete
  using (household_id in (select public.my_admin_household_ids()) or user_id = auth.uid());

-- ── household_id on shared tables ───────────────────────────────────────────

create or replace function public.set_row_household_id()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.household_id is null and new.user_id is not null then
    new.household_id := public.household_of(new.user_id);
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'lifeboard_tasks', 'task_occurrence_exceptions', 'calendar_events', 'calendar_imports',
    'shopping_list_items', 'budget_categories', 'monthly_budgets', 'budget_expenses'
  ] loop
    execute format('alter table public.%I add column if not exists household_id uuid references public.households (id) on delete set null', t);
    execute format('create index if not exists %I on public.%I (household_id)', t || '_household_id_idx', t);

    execute format('drop trigger if exists set_household_id on public.%I', t);
    execute format('create trigger set_household_id before insert on public.%I for each row execute function public.set_row_household_id()', t);

    -- Replace every existing policy — including any created in the dashboard
    -- with names this repo does not know — with the four below.
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format($f$create policy %I on public.%I for select
      using (user_id = auth.uid() or household_id in (select public.my_household_ids()))$f$, t || '_select_household', t);
    execute format($f$create policy %I on public.%I for insert
      with check (user_id = auth.uid() and (household_id is null or household_id in (select public.my_household_ids())))$f$, t || '_insert_own', t);
    execute format($f$create policy %I on public.%I for update
      using (user_id = auth.uid() or household_id in (select public.my_household_ids()))
      with check (user_id = auth.uid() or household_id in (select public.my_household_ids()))$f$, t || '_update_household', t);
    execute format($f$create policy %I on public.%I for delete
      using (user_id = auth.uid() or household_id in (select public.my_household_ids()))$f$, t || '_delete_household', t);
  end loop;
end $$;

-- A shared category has one cap per month, whoever sets it. The old key
-- included user_id, so a second member's upsert created a duplicate row.
-- Existing data satisfies the new key: a category's rows all belonged to its owner.
alter table public.monthly_budgets drop constraint if exists monthly_budgets_user_id_category_id_month_key;
create unique index if not exists monthly_budgets_category_month_key on public.monthly_budgets (category_id, month);

-- ── Joining and leaving ─────────────────────────────────────────────────────

create or replace function public.attach_user_rows_to_household(p_user uuid, p_household uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  pair record;
begin
  update public.lifeboard_tasks set household_id = p_household where user_id = p_user and household_id is null;
  update public.task_occurrence_exceptions set household_id = p_household where user_id = p_user and household_id is null;
  update public.calendar_events set household_id = p_household where user_id = p_user and household_id is null;
  update public.calendar_imports set household_id = p_household where user_id = p_user and household_id is null;
  update public.shopping_list_items set household_id = p_household where user_id = p_user and household_id is null;
  update public.budget_categories set household_id = p_household where user_id = p_user and household_id is null;
  update public.monthly_budgets set household_id = p_household where user_id = p_user and household_id is null;
  update public.budget_expenses set household_id = p_household where user_id = p_user and household_id is null;

  -- Merge the joiner's categories into same-named household categories.
  for pair in
    select distinct on (j.id) j.id as joiner_id, h.id as household_cat_id
    from public.budget_categories j
    join public.budget_categories h
      on h.household_id = p_household
     and h.user_id <> p_user
     and lower(btrim(h.name)) = lower(btrim(j.name))
    where j.user_id = p_user and j.household_id = p_household
    order by j.id, h.created_at
  loop
    update public.budget_expenses set category_id = pair.household_cat_id where category_id = pair.joiner_id;
    -- The household's cap wins where both set one for the same month.
    delete from public.monthly_budgets j
      where j.category_id = pair.joiner_id
        and exists (select 1 from public.monthly_budgets h where h.category_id = pair.household_cat_id and h.month = j.month);
    update public.monthly_budgets set category_id = pair.household_cat_id where category_id = pair.joiner_id;
    delete from public.budget_categories where id = pair.joiner_id;
  end loop;
end;
$$;

create or replace function public.detach_user_rows_from_household(p_user uuid, p_household uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.lifeboard_tasks set household_id = null where user_id = p_user and household_id = p_household;
  update public.task_occurrence_exceptions set household_id = null where user_id = p_user and household_id = p_household;
  update public.calendar_events set household_id = null where user_id = p_user and household_id = p_household;
  update public.calendar_imports set household_id = null where user_id = p_user and household_id = p_household;
  update public.shopping_list_items set household_id = null where user_id = p_user and household_id = p_household;
  update public.budget_categories set household_id = null where user_id = p_user and household_id = p_household;
  update public.monthly_budgets set household_id = null where user_id = p_user and household_id = p_household;
  update public.budget_expenses set household_id = null where user_id = p_user and household_id = p_household;
end;
$$;

revoke execute on function public.attach_user_rows_to_household(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.detach_user_rows_from_household(uuid, uuid) from public, anon, authenticated;

create or replace function public.household_membership_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.status = 'active' and old.user_id is not null
     and (tg_op = 'DELETE' or new.status <> 'active' or new.user_id is distinct from old.user_id) then
    perform public.detach_user_rows_from_household(old.user_id, old.household_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.status = 'active' and new.user_id is not null
     and (tg_op = 'INSERT' or old.status <> 'active' or old.user_id is distinct from new.user_id) then
    perform public.attach_user_rows_to_household(new.user_id, new.household_id);
  end if;
  return null;
end;
$$;

drop trigger if exists household_membership_changed on public.household_members;
create trigger household_membership_changed
  after insert or update of status, user_id or delete on public.household_members
  for each row execute function public.household_membership_changed();

-- ── RPCs used by the app ────────────────────────────────────────────────────

create or replace function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if public.household_of(v_uid) is not null then raise exception 'ALREADY_MEMBER' using errcode = 'P0001'; end if;

  insert into public.households (name, created_by) values (coalesce(nullif(btrim(p_name), ''), 'My Household'), v_uid)
    returning id into v_household;
  insert into public.household_members (household_id, user_id, role, status, invited_email, display_name, joined_at)
    values (v_household, v_uid, 'admin', 'active', lower(auth.jwt() ->> 'email'), p_display_name, now());
  return v_household;
end;
$$;

-- Readable without a session: the public /join page shows who invited you.
create or replace function public.household_invite_preview(p_token uuid)
returns table (household_name text, inviter_name text, invited_email text, status text)
language sql stable security definer set search_path = ''
as $$
  select h.name,
         coalesce((select a.display_name from public.household_members a
                   where a.household_id = h.id and a.role = 'admin' and a.status = 'active'
                   order by a.joined_at nulls last limit 1), 'A family member'),
         m.invited_email,
         m.status
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.invite_token = p_token
$$;

create or replace function public.accept_household_invite(p_token uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(auth.jwt() ->> 'email');
  v_invite public.household_members%rowtype;
  v_current uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;

  select * into v_invite from public.household_members where invite_token = p_token for update;
  if not found then raise exception 'INVITE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_invite.status = 'active' then
    if v_invite.user_id = v_uid then return v_invite.household_id; end if;
    raise exception 'INVITE_USED' using errcode = 'P0001';
  end if;

  v_current := public.household_of(v_uid);
  if v_current = v_invite.household_id then
    delete from public.household_members where id = v_invite.id;
    return v_current;
  end if;
  if v_current is not null then
    -- Partners often each start a household before one invites the other.
    -- A household with no other active member is abandoned; a real one is not.
    if exists (select 1 from public.household_members
               where household_id = v_current and status = 'active' and user_id <> v_uid) then
      raise exception 'ALREADY_MEMBER' using errcode = 'P0001';
    end if;
    delete from public.households where id = v_current;
  end if;

  update public.household_members
    set user_id = v_uid, status = 'active', joined_at = now(),
        invited_email = coalesce(invited_email, v_email)
    where id = v_invite.id;

  -- Link the roster entry with this email to the account, for assignee reminders.
  update public.households h
    set family_roster = coalesce((
      select jsonb_agg(case when lower(r ->> 'email') in (v_email, lower(v_invite.invited_email))
                            then r || jsonb_build_object('userId', v_uid) else r end order by ord)
      from jsonb_array_elements(h.family_roster) with ordinality as x(r, ord)), '[]'::jsonb)
    where h.id = v_invite.household_id;

  return v_invite.household_id;
end;
$$;

-- An invite addressed to the signed-in user's email, for users who signed up
-- directly instead of following the link.
create or replace function public.my_pending_invite_token()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.invite_token from public.household_members m
  where m.status = 'pending' and lower(m.invited_email) = lower(auth.jwt() ->> 'email')
  order by m.invited_at desc limit 1
$$;

revoke execute on function public.create_household(text, text) from public, anon;
revoke execute on function public.accept_household_invite(uuid) from public, anon;
revoke execute on function public.my_pending_invite_token() from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.accept_household_invite(uuid) to authenticated;
grant execute on function public.my_pending_invite_token() to authenticated;
grant execute on function public.household_invite_preview(uuid) to anon, authenticated;

-- ── Backfill: households that already have active members ──────────────────

do $$
declare
  m record;
begin
  for m in select user_id, household_id from public.household_members where status = 'active' and user_id is not null loop
    perform public.attach_user_rows_to_household(m.user_id, m.household_id);
  end loop;
end $$;

-- ── Verify (run separately; read-only) ──────────────────────────────────────
-- Every shared table has RLS on and exactly these four policies:
--   select c.relname, c.relrowsecurity, array_agg(p.policyname order by p.policyname)
--   from pg_class c left join pg_policies p on p.tablename = c.relname and p.schemaname = 'public'
--   where c.relnamespace = 'public'::regnamespace
--     and c.relname in ('lifeboard_tasks','task_occurrence_exceptions','calendar_events','calendar_imports',
--                       'shopping_list_items','budget_categories','monthly_budgets','budget_expenses')
--   group by 1, 2 order by 1;
-- The membership policies no longer recurse (this errored with 42P17 before):
--   select count(*) from public.household_members;   -- run as an authenticated user
