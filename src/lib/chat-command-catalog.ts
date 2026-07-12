import { z } from 'zod/v4'

/**
 * Single source of truth for the chat command catalog.
 *
 * Each command is defined once — name, model-facing description, mutation
 * flag, and a zod/v4 params schema with per-field descriptions — and from it
 * we derive:
 *   - `executeCommandSchema`: request validation for /api/chat/execute-command
 *   - `LifeboardCommand`: the TS union consumed by executeCommand()
 *   - `REALTIME_TOOLS`: OpenAI Realtime tool definitions (via z.toJSONSchema)
 *   - `isMutatingAction`: server-declared effect flag for the client contract
 *
 * The typed-chat prompt (getCommandsPrompt in chat-commands.ts) stays
 * hand-written — its wording is prompt engineering — but a lockstep test in
 * __tests__/chat-command-catalog.test.ts fails if it drifts from this catalog.
 *
 * Uses the zod/v4 subpath (shipped inside zod 3.25+) for z.toJSONSchema;
 * the rest of validations.ts remains on classic zod.
 */

// Validation primitives — same accept/reject sets as the pre-catalog
// executeCommandSchema in validations.ts.
const dateString = (desc: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').describe(desc)
// executeCommand() expects a plain 0-23 number (unlike task routes' hourSlot,
// which also accepts display strings)
const hourSlot = (desc: string) => z.number().int().min(0).max(23).describe(desc)
const bucketName = (desc: string) => z.string().min(1).max(100).describe(desc)

const createTaskParams = z.object({
  content: z.string().min(1).max(500).describe('The task text, without the word "task"'),
  due_date: dateString('Due date as YYYY-MM-DD, if the user gave one').optional(),
  hour_slot: hourSlot('Hour of day 0-23 if a time was given (e.g. 3pm = 15)').optional(),
  bucket: bucketName('Bucket/category name if clearly implied (e.g. Work, Personal, Household)').optional(),
})

const completeTaskParams = z.object({
  task_name: z.string().min(1).max(500).describe('Name of the task to complete, as shown in the dashboard context'),
})

const deleteTaskParams = z.object({
  task_name: z.string().min(1).max(500).describe('Name of the task to delete, as shown in the dashboard context'),
})

const rescheduleTaskParams = z.object({
  task_name: z.string().min(1).max(500).describe('Name of the task to move, as shown in the dashboard context'),
  new_due_date: dateString('New due date as YYYY-MM-DD'),
  hour_slot: hourSlot('New hour of day 0-23, if a time was given').optional(),
})

const editTaskParams = z.object({
  task_name: z.string().min(1).max(500).describe('Current name of the task, as shown in the dashboard context'),
  new_content: z.string().min(1).max(500).describe('Updated task text, if the user wants it renamed').optional(),
  due_date: dateString('Updated due date as YYYY-MM-DD').optional(),
  hour_slot: hourSlot('Updated hour of day 0-23').optional(),
  bucket: bucketName('Updated bucket/category name').optional(),
})

const addCalendarEventParams = z.object({
  title: z.string().min(1).max(300).describe('Event title'),
  date: dateString('Event date as YYYY-MM-DD'),
  time: z.string().regex(/^\d{1,2}:\d{2}$/, 'Must be HH:MM format').describe('Start time as HH:MM (24-hour), omit for all-day events').optional(),
  duration_minutes: z.number().int().min(1).max(1440).describe('Duration in minutes, if given').optional(),
  all_day: z.boolean().describe('True if this is an all-day event').optional(),
  bucket: bucketName('Bucket/category name if clearly implied').optional(),
  description: z.string().max(2000).describe('Extra details, if given').optional(),
})

const addShoppingItemParams = z.object({
  name: z.string().min(1).max(300).describe('Item name'),
  quantity: z.string().max(50).describe('Amount, e.g. "2" or "1 dozen", if given').optional(),
  bucket: bucketName('Bucket/category name if clearly implied').optional(),
  notes: z.string().max(500).describe('Extra details, if given').optional(),
})

const removeShoppingItemParams = z.object({
  item_name: z.string().min(1).max(300).describe('Name of the item to remove, as shown in the dashboard context'),
})

const refreshContextParams = z.object({})

export const COMMAND_CATALOG = [
  {
    name: 'create_task',
    mutates: true,
    description: "Create a new task on the user's dashboard. Use whenever the user asks to add a task, a to-do, or a reminder to do something.",
    params: createTaskParams,
  },
  {
    name: 'complete_task',
    mutates: true,
    description: 'Mark an existing task as done. Use the task name exactly as it appears in the dashboard context.',
    params: completeTaskParams,
  },
  {
    name: 'delete_task',
    mutates: true,
    description: 'Delete an existing task. Only when the user explicitly asks to delete/remove a task (not complete it).',
    params: deleteTaskParams,
  },
  {
    name: 'reschedule_task',
    mutates: true,
    description: 'Move an existing task to a different date and/or time.',
    params: rescheduleTaskParams,
  },
  {
    name: 'edit_task',
    mutates: true,
    description: "Change an existing task's text, date, time, or bucket.",
    params: editTaskParams,
  },
  {
    name: 'add_calendar_event',
    mutates: true,
    description: "Add an event to the user's calendar (meetings, appointments, anything with a date, unlike tasks which are to-dos).",
    params: addCalendarEventParams,
  },
  {
    name: 'add_shopping_item',
    mutates: true,
    description: "Add an item to the user's shopping list.",
    params: addShoppingItemParams,
  },
  {
    name: 'remove_shopping_item',
    mutates: true,
    description: 'Remove an item from the shopping list. Use the item name exactly as it appears in the dashboard context.',
    params: removeShoppingItemParams,
  },
  {
    name: 'refresh_context',
    mutates: false,
    description: "Fetch the user's current dashboard state (tasks, calendar, shopping list). Call before answering questions about current state if it may have changed since the conversation started.",
    params: refreshContextParams,
  },
] as const

/**
 * One Lifeboard command, as sent by the realtime voice client when the model
 * calls a tool. `refresh_context` re-reads dashboard state instead of mutating.
 */
export const executeCommandSchema = z.discriminatedUnion('action', [
  createTaskParams.extend({ action: z.literal('create_task') }),
  completeTaskParams.extend({ action: z.literal('complete_task') }),
  deleteTaskParams.extend({ action: z.literal('delete_task') }),
  rescheduleTaskParams.extend({ action: z.literal('reschedule_task') }),
  editTaskParams.extend({ action: z.literal('edit_task') }),
  addCalendarEventParams.extend({ action: z.literal('add_calendar_event') }),
  addShoppingItemParams.extend({ action: z.literal('add_shopping_item') }),
  removeShoppingItemParams.extend({ action: z.literal('remove_shopping_item') }),
  refreshContextParams.extend({ action: z.literal('refresh_context') }),
])

export type ExecuteCommandInput = z.infer<typeof executeCommandSchema>
export type LifeboardCommand = Exclude<ExecuteCommandInput, { action: 'refresh_context' }>

const MUTATING_ACTIONS = new Set<string>(
  COMMAND_CATALOG.filter(c => c.mutates).map(c => c.name)
)

/** Whether a command changes dashboard data (drives the client's refresh). */
export function isMutatingAction(action: string): boolean {
  return MUTATING_ACTIONS.has(action)
}

/** OpenAI tool `parameters` must be bare JSON Schema — drop the $schema key. */
function toolParameters(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _schema, ...parameters } = z.toJSONSchema(schema)
  return parameters
}

/**
 * Native tool definitions for the OpenAI Realtime GA session. The client
 * executes each call via POST /api/chat/execute-command, so `name` equals the
 * command `action` and parameter shapes satisfy executeCommandSchema above —
 * by construction, since both derive from the same params schemas.
 */
export const REALTIME_TOOLS = COMMAND_CATALOG.map(({ name, description, params }) => ({
  type: 'function' as const,
  name,
  description,
  parameters: toolParameters(params),
}))
