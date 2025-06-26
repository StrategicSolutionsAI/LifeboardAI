-- Track daily snapshot of each widget's progress so we can build trends/analytics
create table if not exists widget_progress_history (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users on delete cascade,
    widget_instance_id text not null,
    "date" date not null,
    value int not null,
    created_at timestamptz default now(),
    unique (user_id, widget_instance_id, "date")
); 