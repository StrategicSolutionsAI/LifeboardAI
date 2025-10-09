-- Track preferred bucket for uploaded calendars so users can retag events later
alter table if exists public.calendar_imports
  add column if not exists default_bucket text;

-- Existing rows already mirror bucket values on individual events; leave as NULL to avoid overrides
