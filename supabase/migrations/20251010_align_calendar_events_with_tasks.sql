-- Ensure calendar_events presents the same task-centric fields as lifeboard_tasks
alter table public.calendar_events
  add column if not exists content text,
  add column if not exists completed boolean not null default false,
  add column if not exists due_date date,
  add column if not exists hour_slot text,
  add column if not exists bucket text,
  add column if not exists position integer,
  add column if not exists duration integer,
  add column if not exists repeat_rule text;

-- Keep newly added columns tidy
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'calendar_events'
      and indexname = 'idx_calendar_events_bucket'
  ) then
    execute 'create index idx_calendar_events_bucket on public.calendar_events(bucket)';
  end if;
end $$ language plpgsql;

-- Default imported rows to the same bucket name as lifeboard tasks
update public.calendar_events
set bucket = coalesce(bucket, 'Imported Calendar')
where source = 'uploaded_calendar' and bucket is null;
