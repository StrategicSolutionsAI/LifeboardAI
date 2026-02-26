-- Add kanban_status column to lifeboard_tasks for Kanban board view
-- Valid values: 'todo', 'in_progress', 'done'
alter table public.lifeboard_tasks
  add column if not exists kanban_status text not null default 'todo';

-- Backfill: completed tasks should be 'done'
update public.lifeboard_tasks set kanban_status = 'done' where completed = true;
