-- Delete an uploaded calendar and its generated tasks atomically.
-- The function is intentionally invoker-security so RLS remains the final
-- tenant boundary; every predicate also requires auth.uid().
create or replace function public.delete_calendar_import(p_import_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  deleted_tasks integer := 0;
  deleted_events integer := 0;
  deleted_imports integer := 0;
begin
  if not exists (
    select 1
    from public.calendar_imports
    where id = p_import_id and user_id = auth.uid()
  ) then
    return jsonb_build_object('found', false, 'deletedTasks', 0, 'deletedEvents', 0);
  end if;

  delete from public.lifeboard_tasks
  where user_id = auth.uid()
    and id in (
      select task_id
      from public.calendar_events
      where import_id = p_import_id
        and user_id = auth.uid()
        and task_id is not null
    );
  get diagnostics deleted_tasks = row_count;

  delete from public.calendar_events
  where import_id = p_import_id and user_id = auth.uid();
  get diagnostics deleted_events = row_count;

  delete from public.calendar_imports
  where id = p_import_id and user_id = auth.uid();
  get diagnostics deleted_imports = row_count;

  return jsonb_build_object(
    'found', deleted_imports = 1,
    'deletedTasks', deleted_tasks,
    'deletedEvents', deleted_events
  );
end;
$$;
