import type { Task } from '@/types/tasks'

export const TASK_SELECT_COLUMNS =
  'id, user_id, content, completed, due_date, start_date, end_date, hour_slot, end_hour_slot, bucket, position, duration, repeat_rule, all_day, kanban_status, assignee_id, created_at, updated_at'

export function mapRowToTask(row: any): Task {
  // due_date is the canonical date users change; start_date is for range spans
  const dueDate: string | undefined = row.due_date ?? row.start_date ?? undefined
  const startDate: string | undefined = row.start_date ?? dueDate ?? undefined
  const rawEndDate: string | undefined = row.end_date ?? startDate ?? undefined
  // For non-recurring tasks, endDate must never be before startDate.
  // This can happen when a task's due/start date is moved forward but
  // end_date isn't updated in the DB.
  const rule = row.repeat_rule
  const endDate: string | undefined =
    (!rule || rule === 'none') && rawEndDate && startDate && rawEndDate < startDate
      ? startDate
      : rawEndDate
  return {
    id: row.id,
    content: row.content,
    completed: row.completed,
    due: dueDate ? { date: dueDate } : undefined,
    startDate: dueDate ?? startDate,
    endDate,
    hourSlot: row.hour_slot || undefined,
    endHourSlot: row.end_hour_slot || undefined,
    bucket: row.bucket || undefined,
    position: row.position ?? undefined,
    duration: row.duration ?? undefined,
    repeatRule: row.repeat_rule && row.repeat_rule !== 'none' ? row.repeat_rule : undefined,
    allDay: row.all_day ?? (row.hour_slot ? false : true),
    kanbanStatus: row.kanban_status ?? (row.completed ? 'done' : 'todo'),
    assigneeId: row.assignee_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
