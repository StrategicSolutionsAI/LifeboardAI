-- Add a task reference to calendar events so imported items can surface as editable tasks
alter table public.calendar_events
  add column if not exists task_id uuid references public.lifeboard_tasks(id) on delete set null;

create index if not exists idx_calendar_events_task_id on public.calendar_events(task_id);
