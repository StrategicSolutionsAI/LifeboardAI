-- Lifeboard multi-day event support
-- Adds explicit start/end columns for tasks and calendar events so multi-day spans can be represented.

-- Extend lifeboard_tasks with start/end fields and richer all-day semantics
alter table public.lifeboard_tasks
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists end_hour_slot text,
  add column if not exists all_day boolean;

-- Ensure sensible defaults for newly introduced fields
alter table public.lifeboard_tasks
  alter column all_day set default false;

update public.lifeboard_tasks
set
  start_date    = coalesce(start_date, due_date),
  end_date      = coalesce(end_date, coalesce(start_date, due_date)),
  all_day       = case
                    when hour_slot is null then true
                    else coalesce(all_day, false)
                  end
where
  start_date is null
  or end_date is null
  or all_day is null;

-- Persist fallback false for any remaining null all_day flags
update public.lifeboard_tasks
set all_day = false
where all_day is null;

-- Enforce non-null constraint now that data is backfilled
alter table public.lifeboard_tasks
  alter column all_day set not null;

-- Helpful indexes for range queries
create index if not exists lifeboard_tasks_user_start_date_idx
  on public.lifeboard_tasks (user_id, start_date);

create index if not exists lifeboard_tasks_user_end_date_idx
  on public.lifeboard_tasks (user_id, end_date);

-- Mirror end-hour metadata on calendar_events (start/end/date/time columns already exist)
alter table public.calendar_events
  add column if not exists end_hour_slot text;

-- Normalize all-day values and fill in missing start/end dates
alter table public.calendar_events
  alter column all_day set default false;

update public.calendar_events
set
  start_date = coalesce(
    start_date,
    due_date,
    case when start_time is not null then (start_time AT TIME ZONE 'UTC')::date end
  ),
  end_date = coalesce(
    end_date,
    case
      when end_time is not null then (end_time AT TIME ZONE 'UTC')::date
      else coalesce(start_date, due_date)
    end
  ),
  all_day = case
              when start_time is null
               and end_time is null
               and hour_slot is null
               and end_hour_slot is null then true
              else coalesce(all_day, false)
            end
where
  start_date is null
  or end_date is null
  or all_day is null;

update public.calendar_events
set all_day = false
where all_day is null;

alter table public.calendar_events
  alter column all_day set not null;

-- Index to accelerate range lookups on calendar events
create index if not exists calendar_events_user_start_date_idx
  on public.calendar_events (user_id, start_date);

create index if not exists calendar_events_user_end_date_idx
  on public.calendar_events (user_id, end_date);
