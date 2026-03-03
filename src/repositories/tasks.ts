import type { Task } from '@/types/tasks'

export const TASK_SELECT_COLUMNS =
  'id, user_id, content, completed, due_date, start_date, end_date, hour_slot, end_hour_slot, bucket, position, duration, repeat_rule, all_day, kanban_status, created_at, updated_at'

export function mapRowToTask(row: any): Task {
  const startDate: string | undefined = row.start_date ?? row.due_date ?? undefined
  const endDate: string | undefined = row.end_date ?? startDate ?? undefined
  return {
    id: row.id,
    content: row.content,
    completed: row.completed,
    due: startDate ? { date: startDate } : undefined,
    startDate,
    endDate,
    hourSlot: row.hour_slot || undefined,
    endHourSlot: row.end_hour_slot || undefined,
    bucket: row.bucket || undefined,
    position: row.position ?? undefined,
    duration: row.duration ?? undefined,
    repeatRule: row.repeat_rule && row.repeat_rule !== 'none' ? row.repeat_rule : undefined,
    allDay: row.all_day ?? (row.hour_slot ? false : true),
    kanbanStatus: row.kanban_status ?? (row.completed ? 'done' : 'todo'),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
