-- Track uploaded calendar files and associate events with a specific import
create table if not exists public.calendar_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  file_name text,
  event_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_imports enable row level security;

drop policy if exists "Users can view their own calendar imports" on public.calendar_imports;
create policy "Users can view their own calendar imports"
on public.calendar_imports for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own calendar imports" on public.calendar_imports;
create policy "Users can insert their own calendar imports"
on public.calendar_imports for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own calendar imports" on public.calendar_imports;
create policy "Users can update their own calendar imports"
on public.calendar_imports for update
using (auth.uid() = user_id);

drop policy if exists "Users can delete their own calendar imports" on public.calendar_imports;
create policy "Users can delete their own calendar imports"
on public.calendar_imports for delete
using (auth.uid() = user_id);

create index if not exists idx_calendar_imports_user_id on public.calendar_imports(user_id);

-- Maintain updated_at automatically
create trigger set_calendar_imports_updated_at
before update on public.calendar_imports
for each row
execute function public.set_current_timestamp_updated_at();

-- Associate calendar events with a specific import
alter table public.calendar_events
  add column if not exists import_id uuid references public.calendar_imports(id) on delete cascade;

create index if not exists idx_calendar_events_import_id on public.calendar_events(import_id);

alter table public.calendar_events
  drop constraint if exists calendar_events_user_id_external_id_source_key;

alter table public.calendar_events
  add constraint calendar_events_user_source_external_import_key
    unique (user_id, external_id, source, import_id);
