import { z } from 'zod'
import { NextResponse } from 'next/server'

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
  assignee_id: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
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
  assignee_id: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
})

// ---------- Shopping List ----------

export const createShoppingItemSchema = z.object({
  name: z.string().min(1, 'name required').max(500),
  bucket: z.string().max(200).nullable().optional(),
  quantity: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  neededBy: dateString.nullable().optional(),
  assigneeId: z.string().nullable().optional(),
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
  assigneeId: z.string().nullable().optional(),
})

export const deleteShoppingItemSchema = z.object({
  id: z.string().min(1, 'id required'),
})

// ---------- Household ----------

export const createHouseholdSchema = z.object({
  name: z.string().min(1, 'name required').max(100),
})

export const inviteHouseholdMemberSchema = z.object({
  email: z.string().email('valid email required'),
  displayName: z.string().max(100).optional(),
})

export const updateHouseholdMemberSchema = z.object({
  memberId: z.string().min(1, 'memberId required'),
  role: z.enum(['admin', 'member']).optional(),
  displayName: z.string().max(100).optional(),
})

// ---------- Budget ----------

const monthDate = z.string().regex(/^\d{4}-\d{2}-01$/, 'Must be YYYY-MM-01 format')

export const createBudgetCategorySchema = z.object({
  name: z.string().min(1, 'name required').max(100),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export const updateBudgetCategorySchema = z.object({
  id: z.string().min(1, 'id required'),
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export const deleteBudgetCategorySchema = z.object({
  id: z.string().min(1, 'id required'),
})

export const createBudgetExpenseSchema = z.object({
  categoryId: z.string().min(1, 'categoryId required'),
  amount: z.number().positive('amount must be positive'),
  date: dateString.optional(),
  note: z.string().max(500).nullable().optional(),
})

export const updateBudgetExpenseSchema = z.object({
  id: z.string().min(1, 'id required'),
  categoryId: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  date: dateString.optional(),
  note: z.string().max(500).nullable().optional(),
})

export const deleteBudgetExpenseSchema = z.object({
  id: z.string().min(1, 'id required'),
})

export const upsertMonthlyBudgetSchema = z.object({
  categoryId: z.string().min(1, 'categoryId required'),
  month: monthDate,
  amount: z.number().min(0, 'amount must be non-negative'),
})

// ---------- Helpers ----------

/**
 * Parse and validate request body with a Zod schema.
 * Returns { data } on success or { error, response } on failure.
 */
export function parseBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): { data: z.infer<T>; error?: never; response?: never } | { data?: never; error: z.ZodError; response: NextResponse } {
  const result = schema.safeParse(body)
  if (result.success) {
    return { data: result.data }
  }
  const messages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
  return {
    error: result.error,
    response: NextResponse.json(
      { error: messages, code: 'VALIDATION_ERROR' },
      { status: 400 }
    ),
  }
}
