alter table public.shopping_list_items
  add column if not exists calendar_event_id uuid references public.calendar_events(id) on delete set null,
  add column if not exists calendar_event_created_at timestamptz,
  add column if not exists widget_instance_id text,
  add column if not exists widget_created_at timestamptz,
  add column if not exists widget_bucket text,
  add column if not exists task_id uuid references public.lifeboard_tasks(id) on delete set null,
  add column if not exists task_created_at timestamptz;

create index if not exists shopping_list_items_event_idx
  on public.shopping_list_items (calendar_event_id);

create index if not exists shopping_list_items_widget_idx
  on public.shopping_list_items (widget_instance_id);

create index if not exists shopping_list_items_task_idx
  on public.shopping_list_items (task_id);
