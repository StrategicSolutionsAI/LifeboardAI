export const SHOPPING_LIST_SELECT_COLUMNS =
  [
    'id',
    'user_id',
    'bucket',
    'name',
    'quantity',
    'notes',
    'is_purchased',
    'needed_by',
    'calendar_event_id',
    'calendar_event_created_at',
    'widget_instance_id',
    'widget_created_at',
    'widget_bucket',
    'task_id',
    'task_created_at',
    'created_at',
    'updated_at',
  ].join(', ')

export function mapRowToItem(row: any) {
  return {
    id: row.id as string,
    bucket: row.bucket ?? null,
    name: row.name as string,
    quantity: row.quantity ?? null,
    notes: row.notes ?? null,
    isPurchased: Boolean(row.is_purchased),
    neededBy: row.needed_by ?? null,
    calendarEventId: row.calendar_event_id ?? null,
    calendarEventCreatedAt: row.calendar_event_created_at ?? null,
    widgetInstanceId: row.widget_instance_id ?? null,
    widgetCreatedAt: row.widget_created_at ?? null,
    widgetBucket: row.widget_bucket ?? null,
    taskId: row.task_id ?? null,
    taskCreatedAt: row.task_created_at ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
