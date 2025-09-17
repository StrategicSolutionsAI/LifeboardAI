-- Add repeat rule column to lifeboard_tasks so we can persist recurrence metadata
alter table public.lifeboard_tasks
  add column if not exists repeat_rule text null;
