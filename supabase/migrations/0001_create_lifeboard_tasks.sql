-- Lifeboard tasks table for users without Todoist (or for unified tasks)
-- Run this migration in your Supabase project.

-- Ensure pgcrypto is available for gen_random_uuid()
create extension if not exists pgcrypto;

create table if not exists public.lifeboard_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  completed boolean not null default false,
  due_date date null,
  hour_slot text null,
  bucket text null,
  position integer null,
  duration integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lifeboard_tasks enable row level security;

-- Basic policies: users can manage their own rows
do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'lifeboard_tasks' and policyname = 'lifeboard_tasks_select_own'
  ) then
    create policy "lifeboard_tasks_select_own"
      on public.lifeboard_tasks for select
      using (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'lifeboard_tasks' and policyname = 'lifeboard_tasks_insert_own'
  ) then
    create policy "lifeboard_tasks_insert_own"
      on public.lifeboard_tasks for insert
      with check (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'lifeboard_tasks' and policyname = 'lifeboard_tasks_update_own'
  ) then
    create policy "lifeboard_tasks_update_own"
      on public.lifeboard_tasks for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'lifeboard_tasks' and policyname = 'lifeboard_tasks_delete_own'
  ) then
    create policy "lifeboard_tasks_delete_own"
      on public.lifeboard_tasks for delete
      using (auth.uid() = user_id);
  end if;
end $$ language plpgsql;

-- Trigger to auto-update updated_at on updates
create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_lifeboard_tasks_updated_at on public.lifeboard_tasks;
create trigger set_lifeboard_tasks_updated_at
before update on public.lifeboard_tasks
for each row execute function public.set_current_timestamp_updated_at();

-- Helpful indexes
create index if not exists lifeboard_tasks_user_id_idx on public.lifeboard_tasks (user_id);
create index if not exists lifeboard_tasks_user_due_idx on public.lifeboard_tasks (user_id, due_date);
create index if not exists lifeboard_tasks_user_completed_idx on public.lifeboard_tasks (user_id, completed);
