-- ============================================================================
-- Calendar feed subscriptions (school, team and shared calendars by URL)
--
-- A subscribed calendar is a calendar_imports row with a feed_url. Its events
-- are written exactly like an .ics upload (source = 'uploaded_calendar', same
-- import_id), and a scheduled job re-fetches the feed, updating changed
-- events and removing ones the publisher deleted.
-- ============================================================================

alter table public.calendar_imports add column if not exists feed_url text;
alter table public.calendar_imports add column if not exists last_synced_at timestamptz;
alter table public.calendar_imports add column if not exists last_sync_error text;

create index if not exists calendar_imports_feed_due_idx
  on public.calendar_imports (last_synced_at nulls first)
  where feed_url is not null;
