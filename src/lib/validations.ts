import { z } from 'zod'

// Reusable date string pattern: YYYY-MM-DD
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')

// Hour slot: number 0-23 or display string like "hour-7AM"
const hourSlot = z.union([
  z.number().int().min(0).max(23),
  z.string().min(1),
])

// ---------- Tasks ----------

export const createTaskSchema = z.object({
  content: z.string().min(1, 'content required').max(2000),
  due_date: dateString.nullable().optional(),
  start_date: dateString.nullable().optional(),
  end_date: dateString.nullable().optional(),
  hour_slot: hourSlot.nullable().optional(),
  hourSlot: hourSlot.nullable().optional(),
  end_hour_slot: hourSlot.nullable().optional(),
  endHourSlot: hourSlot.nullable().optional(),
  bucket: z.string().max(200).nullable().optional(),
  duration: z.number().positive().nullable().optional(),
  position: z.number().nullable().optional(),
  all_day: z.boolean().optional(),
  allDay: z.boolean().optional(),
  repeat_rule: z.string().max(200).nullable().optional(),
  repeatRule: z.string().max(200).nullable().optional(),
  kanban_status: z.enum(['todo', 'in_progress', 'done']).optional(),
  kanbanStatus: z.enum(['todo', 'in_progress', 'done']).optional(),
})

export const updateTaskSchema = z.object({
  id: z.string().min(1, 'id required'),
  completed: z.boolean().optional(),
  content: z.string().min(1).max(2000).optional(),
  bucket: z.string().max(200).nullable().optional(),
  due_date: dateString.nullable().optional(),
  dueDate: dateString.nullable().optional(),
  start_date: dateString.nullable().optional(),
  startDate: dateString.nullable().optional(),
  end_date: dateString.nullable().optional(),
  endDate: dateString.nullable().optional(),
  hour_slot: hourSlot.nullable().optional(),
  hourSlot: hourSlot.nullable().optional(),
  end_hour_slot: hourSlot.nullable().optional(),
  endHourSlot: hourSlot.nullable().optional(),
  all_day: z.boolean().optional(),
  allDay: z.boolean().optional(),
  duration: z.number().nullable().optional(),
  repeat_rule: z.string().max(200).nullable().optional(),
  repeatRule: z.string().max(200).nullable().optional(),
  kanban_status: z.enum(['todo', 'in_progress', 'done']).optional(),
  kanbanStatus: z.enum(['todo', 'in_progress', 'done']).optional(),
})

// ---------- Shopping List ----------

export const createShoppingItemSchema = z.object({
  name: z.string().min(1, 'name required').max(500),
  bucket: z.string().max(200).nullable().optional(),
  quantity: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  neededBy: dateString.nullable().optional(),
})

export const updateShoppingItemSchema = z.object({
  id: z.string().min(1, 'id required'),
  name: z.string().min(1).max(500).optional(),
  bucket: z.string().max(200).nullable().optional(),
  quantity: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  neededBy: dateString.nullable().optional(),
  isPurchased: z.boolean().optional(),
  calendarEventId: z.string().nullable().optional(),
  calendarEventCreatedAt: z.string().nullable().optional(),
  widgetInstanceId: z.string().nullable().optional(),
  widgetCreatedAt: z.string().nullable().optional(),
  widgetBucket: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  taskCreatedAt: z.string().nullable().optional(),
})

export const deleteShoppingItemSchema = z.object({
  id: z.string().min(1, 'id required'),
})

// ---------- Helpers ----------

/**
 * Parse and validate request body with a Zod schema.
 * Returns { data } on success or { error, response } on failure.
 */
export function parseBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): { data: z.infer<T>; error?: never; response?: never } | { data?: never; error: z.ZodError; response: Response } {
  const result = schema.safeParse(body)
  if (result.success) {
    return { data: result.data }
  }
  const messages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
  return {
    error: result.error,
    response: new Response(
      JSON.stringify({ error: messages, code: 'VALIDATION_ERROR' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    ),
  }
}
