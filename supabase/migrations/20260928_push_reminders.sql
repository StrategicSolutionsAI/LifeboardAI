-- ============================================================================
-- Web push reminders
--
-- push_subscriptions: one row per browser/device that turned reminders on.
--   time_zone lets the server turn a task's client-local date + hour slot into
--   an absolute time (the app stores YYYY-MM-DD keys in the user's local time).
-- task_reminder_log: claims each (task, recipient, occurrence date) once, so a
--   cron run that overlaps or retries never sends the same reminder twice. Only
--   the service role touches it: RLS on, no policies.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  time_zone    text not null default 'UTC',
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions for select
  using (user_id = auth.uid());
drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own" on public.push_subscriptions for insert
  with check (user_id = auth.uid());
drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own" on public.push_subscriptions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions for delete
  using (user_id = auth.uid());

create table if not exists public.task_reminder_log (
  task_id         uuid not null references public.lifeboard_tasks (id) on delete cascade,
  recipient_id    uuid not null references auth.users (id) on delete cascade,
  occurrence_date date not null,
  sent_at         timestamptz not null default now(),
  primary key (task_id, recipient_id, occurrence_date)
);

alter table public.task_reminder_log enable row level security;

-- A browser's push endpoint belongs to whoever is signed in on it now. When a
-- different account turns reminders on in the same browser, the row moves to
-- them — RLS would otherwise hide the previous owner's row from the upsert.
create or replace function public.claim_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_time_zone text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, time_zone)
    values (auth.uid(), p_endpoint, p_p256dh, p_auth, coalesce(nullif(p_time_zone, ''), 'UTC'))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        time_zone = excluded.time_zone, created_at = now();
end;
$$;

revoke execute on function public.claim_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.claim_push_subscription(text, text, text, text) to authenticated;
