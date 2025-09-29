-- Task occurrence exceptions allow single-instance overrides of repeating tasks
-- Applies to both Todoist-backed tasks and local/supabase tasks

create table if not exists public.task_occurrence_exceptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id text not null,
  occurrence_date date not null,
  skip boolean not null default false,
  override_hour_slot text,
  override_duration integer,
  override_bucket text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists task_occurrence_exceptions_user_task_date_idx
  on public.task_occurrence_exceptions (user_id, task_id, occurrence_date);

-- Ensure the timestamp maintenance function exists before creating trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger task_occurrence_exceptions_updated_at
  before update on public.task_occurrence_exceptions
  for each row execute procedure public.set_updated_at();

-- Row level security
alter table public.task_occurrence_exceptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_occurrence_exceptions'
      and policyname = 'Users can manage their task occurrence exceptions'
  ) then
    create policy "Users can manage their task occurrence exceptions"
      on public.task_occurrence_exceptions
      for all using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
