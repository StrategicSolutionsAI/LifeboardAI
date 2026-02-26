import { NextRequest } from 'next/server'

/**
 * Shared chat command infrastructure for LifeboardAI.
 * Used by both /api/chat and /api/chat/voice routes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LifeboardCommand =
  | { action: 'create_task'; content: string; due_date?: string; hour_slot?: number; bucket?: string }
  | { action: 'complete_task'; task_name: string }
  | { action: 'delete_task'; task_name: string }
  | { action: 'reschedule_task'; task_name: string; new_due_date: string; hour_slot?: number }
  | { action: 'edit_task'; task_name: string; new_content?: string; due_date?: string; hour_slot?: number; bucket?: string }
  | { action: 'add_calendar_event'; title: string; date: string; time?: string; duration_minutes?: number; all_day?: boolean; bucket?: string; description?: string }
  | { action: 'add_shopping_item'; name: string; quantity?: string; bucket?: string; notes?: string }
  | { action: 'remove_shopping_item'; item_name: string }

export interface CommandContext {
  supabase: any            // SupabaseClient — uses `any` at boundary (project convention)
  userId: string
  req: NextRequest
  origin: string
}

export interface CommandResult {
  success: boolean
  message: string
  createdTask?: any
}

// ---------------------------------------------------------------------------
// System prompt section
// ---------------------------------------------------------------------------

export function getCommandsPrompt(todayIso: string, currentYear: string): string {
  return `You are Lifeboard's AI assistant with full access to the user's dashboard. Today's date is ${todayIso}.

CONTEXT AWARENESS:
- You can see all tasks, calendar events, shopping lists, and dashboard widgets
- Reference specific items when answering questions (e.g., "I see you have 'Call dentist' scheduled for tomorrow")
- Provide personalized insights based on their actual data
- Help them understand patterns and prioritize work

CRITICAL — COMMAND EXECUTION:
When the user asks you to CREATE, ADD, COMPLETE, DELETE, RESCHEDULE, EDIT, or otherwise modify a task, calendar event, or shopping item, you MUST include the corresponding [LIFEBOARD_CMD] block in your response. Without the command block, no action will actually be taken — the system parses these blocks to execute actions. Saying "I've added your task" without a command block means NOTHING actually happens.

For EVERY actionable request, your response MUST contain:
1. A brief natural language confirmation (shown to the user)
2. The [LIFEBOARD_CMD] JSON block (parsed and executed by the system, hidden from user)

Example — user says "add a task to buy groceries tomorrow":
Sure, I'll add that for you!
[LIFEBOARD_CMD]{"action":"create_task","content":"Buy groceries","due_date":"${todayIso}"}[/LIFEBOARD_CMD]

Available commands (each on its own line, wrapped in [LIFEBOARD_CMD]...[/LIFEBOARD_CMD]):

1. Create a task:
[LIFEBOARD_CMD]{"action":"create_task","content":"<task text>","due_date":"YYYY-MM-DD","hour_slot":<0-23>,"bucket":"<bucket>"}[/LIFEBOARD_CMD]

2. Mark a task as done:
[LIFEBOARD_CMD]{"action":"complete_task","task_name":"<task name as shown in context>"}[/LIFEBOARD_CMD]

3. Delete a task:
[LIFEBOARD_CMD]{"action":"delete_task","task_name":"<task name as shown in context>"}[/LIFEBOARD_CMD]

4. Reschedule a task:
[LIFEBOARD_CMD]{"action":"reschedule_task","task_name":"<task name>","new_due_date":"YYYY-MM-DD","hour_slot":<0-23>}[/LIFEBOARD_CMD]

5. Edit a task:
[LIFEBOARD_CMD]{"action":"edit_task","task_name":"<task name>","new_content":"<updated text>","due_date":"YYYY-MM-DD","hour_slot":<0-23>,"bucket":"<bucket>"}[/LIFEBOARD_CMD]

6. Add a calendar event:
[LIFEBOARD_CMD]{"action":"add_calendar_event","title":"<title>","date":"YYYY-MM-DD","time":"HH:MM","duration_minutes":<number>,"all_day":<boolean>,"bucket":"<bucket>","description":"<desc>"}[/LIFEBOARD_CMD]

7. Add a shopping item:
[LIFEBOARD_CMD]{"action":"add_shopping_item","name":"<item name>","quantity":"<amount>","bucket":"<bucket>"}[/LIFEBOARD_CMD]

8. Mark a shopping item as purchased:
[LIFEBOARD_CMD]{"action":"remove_shopping_item","item_name":"<item name as shown in context>"}[/LIFEBOARD_CMD]

Rules:
- ALWAYS include a [LIFEBOARD_CMD] block when the user requests any action — never just describe the action
- For task_name / item_name fields, use the EXACT name from the context above when possible
- Normalize dates to user's local timezone, use year ${currentYear} unless specified
- Convert times to hour_slot (0=12am to 23=11pm)
- Infer bucket from context if mentioned (Work, Personal, Health, etc.)
- Do not include the word "TASK" in task content
- Keep your natural reply separate from the command blocks
- You can include multiple commands in one reply if the user asks for multiple actions
- Only include fields that are relevant; omit optional fields you don't have values for

CAPABILITIES:
- Execute any of the actions above on behalf of the user
- Answer questions about their schedule, tasks, and shopping list
- Provide summaries and insights
- Help prioritize and organize
- Suggest optimizations based on their data
- Be conversational and helpful`
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const CMD_REGEX = /\[LIFEBOARD_CMD\]([\s\S]*?)\[\/LIFEBOARD_CMD\]/g

/** Extract all command blocks from an AI reply. */
export function parseCommands(reply: string): LifeboardCommand[] {
  if (process.env.LIFEBOARD_TASK_CMDS === 'false') return []
  const commands: LifeboardCommand[] = []
  let match: RegExpExecArray | null
  // Reset lastIndex for safety
  CMD_REGEX.lastIndex = 0
  while ((match = CMD_REGEX.exec(reply)) !== null) {
    try {
      const cmd = JSON.parse(match[1])
      if (cmd && typeof cmd.action === 'string') commands.push(cmd as LifeboardCommand)
    } catch {
      // skip malformed JSON
    }
  }
  return commands
}

/** Remove all command blocks from a reply string. */
export function stripCommandBlocks(reply: string): string {
  return reply.replace(/\[LIFEBOARD_CMD\][\s\S]*?\[\/LIFEBOARD_CMD\]/g, '').trim()
}

// ---------------------------------------------------------------------------
// Name matching
// ---------------------------------------------------------------------------

function matchByName(
  items: any[],
  searchName: string,
  contentField: string,
): any | null {
  const needle = searchName.toLowerCase().trim()
  if (!needle) return null

  const getField = (item: any) => String(item[contentField] || '').toLowerCase()

  // 1. Exact match
  const exact = items.find(i => getField(i).trim() === needle)
  if (exact) return exact

  // 2. Item contains search string
  const contains = items.find(i => getField(i).includes(needle))
  if (contains) return contains

  // 3. Search string contains item name
  const reverse = items.find(i => needle.includes(getField(i).trim()))
  if (reverse) return reverse

  // 4. Word overlap scoring
  const needleWords = needle.split(/\s+/).filter(Boolean)
  let bestMatch: any | null = null
  let bestScore = 0

  for (const item of items) {
    const itemWords = getField(item).split(/\s+/).filter(Boolean)
    let overlap = 0
    for (const w of needleWords) {
      if (itemWords.includes(w)) overlap++
    }
    const score = overlap / Math.max(needleWords.length, itemWords.length)
    if (score > bestScore && score >= 0.3) {
      bestScore = score
      bestMatch = item
    }
  }

  return bestMatch
}

/** Find a task by name across Supabase and (optionally) Todoist. */
async function findTaskByName(
  ctx: CommandContext,
  taskName: string,
): Promise<{ id: string; content: string; source: 'supabase' | 'todoist' } | null> {
  // Try lifeboard_tasks first
  const { data: tasks } = await ctx.supabase
    .from('lifeboard_tasks')
    .select('id, content')
    .eq('user_id', ctx.userId)
    .eq('completed', false)
    .order('created_at', { ascending: false })
    .limit(100)

  if (tasks && tasks.length > 0) {
    const match = matchByName(tasks, taskName, 'content')
    if (match) return { id: match.id, content: match.content, source: 'supabase' }
  }

  // Try Todoist if connected
  const { data: integration } = await ctx.supabase
    .from('user_integrations')
    .select('access_token')
    .eq('user_id', ctx.userId)
    .eq('provider', 'todoist')
    .maybeSingle()

  if (integration?.access_token) {
    try {
      const res = await fetch('https://api.todoist.com/api/v1/tasks', {
        headers: { Authorization: `Bearer ${integration.access_token}` },
      })
      if (res.ok) {
        const todoistTasks: any[] = await res.json()
        const match = matchByName(todoistTasks, taskName, 'content')
        if (match) return { id: match.id, content: match.content, source: 'todoist' }
      }
    } catch (e) {
      console.error('Todoist task lookup failed:', e)
    }
  }

  return null
}

/** Find a shopping item by name. */
async function findShoppingItemByName(
  ctx: CommandContext,
  itemName: string,
): Promise<{ id: string; name: string } | null> {
  const { data: items } = await ctx.supabase
    .from('shopping_list_items')
    .select('id, name')
    .eq('user_id', ctx.userId)
    .eq('is_purchased', false)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!items || items.length === 0) return null
  return matchByName(items, itemName, 'name')
}

// ---------------------------------------------------------------------------
// Internal API helpers
// ---------------------------------------------------------------------------

async function callApi(
  ctx: CommandContext,
  path: string,
  method: string,
  body?: any,
): Promise<{ ok: boolean; data?: any }> {
  try {
    const res = await fetch(`${ctx.origin}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        cookie: ctx.req.headers.get('cookie') || '',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error(`Chat cmd: ${method} ${path} failed (${res.status})`, txt.slice(0, 200))
      return { ok: false }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: true, data }
  } catch (e) {
    console.error(`Chat cmd: ${method} ${path} exception`, e)
    return { ok: false }
  }
}

/** Create a task directly in Supabase so it's visible across all logged-in devices. */
async function createTask(
  ctx: CommandContext,
  payload: { content: string; due_date: string | null; hour_slot?: number; bucket?: string },
): Promise<{ ok: boolean; task?: any }> {
  try {
    const hourSlot = typeof payload.hour_slot === 'number'
      ? `hour-${formatHourSlot(payload.hour_slot)}`
      : undefined

    const startDate = payload.due_date || null
    const insert = {
      user_id: ctx.userId,
      content: payload.content,
      completed: false,
      due_date: startDate,
      start_date: startDate,
      end_date: startDate,
      hour_slot: hourSlot || null,
      end_hour_slot: null,
      bucket: payload.bucket || null,
      duration: null,
      position: null,
      all_day: !hourSlot,
      repeat_rule: null,
    }

    const { data, error } = await ctx.supabase
      .from('lifeboard_tasks')
      .insert(insert)
      .select('id, content, completed, due_date, start_date, end_date, hour_slot, end_hour_slot, bucket, position, duration, repeat_rule, all_day, kanban_status, created_at, updated_at')
      .single()

    if (error) {
      console.error('Chat createTask: Supabase insert failed', error)
      return { ok: false }
    }

    // Return a client-ready task shape
    return {
      ok: true,
      task: {
        id: data.id,
        content: data.content,
        completed: data.completed,
        due: startDate ? { date: startDate } : undefined,
        startDate: data.start_date ?? undefined,
        endDate: data.end_date ?? undefined,
        hourSlot: data.hour_slot || undefined,
        endHourSlot: data.end_hour_slot || undefined,
        bucket: data.bucket || undefined,
        position: data.position ?? undefined,
        duration: data.duration ?? undefined,
        repeatRule: data.repeat_rule || undefined,
        allDay: data.all_day ?? !hourSlot,
        kanbanStatus: data.kanban_status ?? 'todo',
        source: 'supabase',
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    }
  } catch (e) {
    console.error('Chat createTask: exception', e)
    return { ok: false }
  }
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function formatHourSlot(h: number): string {
  if (h === 0) return '12AM'
  if (h < 12) return `${h}AM`
  if (h === 12) return '12PM'
  return `${h - 12}PM`
}

function fixYear(dateStr: string | undefined | null): string | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const yr = Number(dateStr.slice(0, 4))
  const nowYr = new Date().getFullYear()
  if (yr < nowYr) return `${nowYr}${dateStr.slice(4)}`
  return dateStr
}

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

async function executeCommand(cmd: LifeboardCommand, ctx: CommandContext): Promise<CommandResult> {
  switch (cmd.action) {
    // -----------------------------------------------------------------------
    // CREATE TASK
    // -----------------------------------------------------------------------
    case 'create_task': {
      const dueDate = fixYear(cmd.due_date)
      const result = await createTask(ctx, {
        content: cmd.content,
        due_date: dueDate,
        hour_slot: cmd.hour_slot,
        bucket: cmd.bucket,
      })
      if (result.ok) {
        return {
          success: true,
          message: `\n\n✅ I added "${cmd.content}"${dueDate ? ` for ${dueDate}` : ''}.`,
          createdTask: result.task,
        }
      }
      return { success: false, message: `\n\n⚠️ I couldn't create the task right now.` }
    }

    // -----------------------------------------------------------------------
    // COMPLETE TASK
    // -----------------------------------------------------------------------
    case 'complete_task': {
      const task = await findTaskByName(ctx, cmd.task_name)
      if (!task) return { success: false, message: `\n\n⚠️ I couldn't find a task matching "${cmd.task_name}".` }

      let ok = false
      if (task.source === 'todoist') {
        const r = await callApi(ctx, '/api/integrations/todoist/tasks/complete', 'POST', { taskId: task.id })
        ok = r.ok
      } else {
        const r = await callApi(ctx, '/api/tasks/complete', 'POST', { taskId: task.id })
        ok = r.ok
      }
      if (ok) return { success: true, message: `\n\n✅ Marked "${task.content}" as complete.` }
      return { success: false, message: `\n\n⚠️ I couldn't complete "${task.content}".` }
    }

    // -----------------------------------------------------------------------
    // DELETE TASK
    // -----------------------------------------------------------------------
    case 'delete_task': {
      const task = await findTaskByName(ctx, cmd.task_name)
      if (!task) return { success: false, message: `\n\n⚠️ I couldn't find a task matching "${cmd.task_name}".` }

      let ok = false
      if (task.source === 'todoist') {
        const r = await callApi(ctx, '/api/integrations/todoist/tasks/delete', 'DELETE', { taskId: task.id })
        ok = r.ok
      } else {
        const r = await callApi(ctx, '/api/tasks/delete', 'DELETE', { taskId: task.id })
        ok = r.ok
      }
      if (ok) return { success: true, message: `\n\n✅ Deleted "${task.content}".` }
      return { success: false, message: `\n\n⚠️ I couldn't delete "${task.content}".` }
    }

    // -----------------------------------------------------------------------
    // RESCHEDULE TASK
    // -----------------------------------------------------------------------
    case 'reschedule_task': {
      const task = await findTaskByName(ctx, cmd.task_name)
      if (!task) return { success: false, message: `\n\n⚠️ I couldn't find a task matching "${cmd.task_name}".` }

      const newDate = fixYear(cmd.new_due_date)
      let ok = false
      if (task.source === 'todoist') {
        const r = await callApi(ctx, '/api/integrations/todoist/tasks/update', 'POST', {
          taskId: task.id,
          dueDate: newDate,
        })
        ok = r.ok
      } else {
        const body: Record<string, any> = { id: task.id, due_date: newDate }
        if (typeof cmd.hour_slot === 'number') body.hour_slot = cmd.hour_slot
        const r = await callApi(ctx, '/api/tasks', 'PATCH', body)
        ok = r.ok
      }

      const timeStr = typeof cmd.hour_slot === 'number' ? ` at ${formatHourSlot(cmd.hour_slot)}` : ''
      if (ok) return { success: true, message: `\n\n✅ Rescheduled "${task.content}" to ${newDate}${timeStr}.` }
      return { success: false, message: `\n\n⚠️ I couldn't reschedule "${task.content}".` }
    }

    // -----------------------------------------------------------------------
    // EDIT TASK
    // -----------------------------------------------------------------------
    case 'edit_task': {
      const task = await findTaskByName(ctx, cmd.task_name)
      if (!task) return { success: false, message: `\n\n⚠️ I couldn't find a task matching "${cmd.task_name}".` }

      // For Todoist, use batch-update which supports content changes
      if (task.source === 'todoist') {
        const updates: Record<string, any> = {}
        if (cmd.new_content) updates.content = cmd.new_content
        if (cmd.due_date) updates.dueDate = fixYear(cmd.due_date)
        if (typeof cmd.hour_slot === 'number') updates.hourSlot = cmd.hour_slot
        if (cmd.bucket) updates.bucket = cmd.bucket
        const r = await callApi(ctx, '/api/integrations/todoist/tasks/batch-update', 'POST', {
          updates: [{ taskId: task.id, updates }],
        })
        if (r.ok) {
          return { success: true, message: `\n\n✅ Updated "${task.content}"${cmd.new_content ? ` → "${cmd.new_content}"` : ''}.` }
        }
      } else {
        const body: Record<string, any> = { id: task.id }
        if (cmd.new_content) body.content = cmd.new_content
        if (cmd.due_date) body.due_date = fixYear(cmd.due_date)
        if (typeof cmd.hour_slot === 'number') body.hour_slot = cmd.hour_slot
        if (cmd.bucket) body.bucket = cmd.bucket
        const r = await callApi(ctx, '/api/tasks', 'PATCH', body)
        if (r.ok) {
          return { success: true, message: `\n\n✅ Updated "${task.content}"${cmd.new_content ? ` → "${cmd.new_content}"` : ''}.` }
        }
      }
      return { success: false, message: `\n\n⚠️ I couldn't update "${task.content}".` }
    }

    // -----------------------------------------------------------------------
    // ADD CALENDAR EVENT
    // -----------------------------------------------------------------------
    case 'add_calendar_event': {
      const body: Record<string, any> = { title: cmd.title, date: fixYear(cmd.date) || cmd.date }
      if (cmd.time) body.time = cmd.time
      if (cmd.duration_minutes) body.durationMinutes = cmd.duration_minutes
      if (cmd.all_day !== undefined) body.allDay = cmd.all_day
      if (cmd.bucket) body.bucket = cmd.bucket
      if (cmd.description) body.description = cmd.description

      const r = await callApi(ctx, '/api/calendar/events', 'POST', body)
      if (r.ok) {
        return { success: true, message: `\n\n✅ Added "${cmd.title}" to your calendar on ${body.date}${cmd.time ? ` at ${cmd.time}` : ''}.` }
      }
      return { success: false, message: `\n\n⚠️ I couldn't add the calendar event.` }
    }

    // -----------------------------------------------------------------------
    // ADD SHOPPING ITEM
    // -----------------------------------------------------------------------
    case 'add_shopping_item': {
      const body: Record<string, any> = { name: cmd.name }
      if (cmd.quantity) body.quantity = cmd.quantity
      if (cmd.bucket) body.bucket = cmd.bucket
      if (cmd.notes) body.notes = cmd.notes

      const r = await callApi(ctx, '/api/shopping-list', 'POST', body)
      if (r.ok) {
        return { success: true, message: `\n\n✅ Added "${cmd.name}"${cmd.quantity ? ` (${cmd.quantity})` : ''} to your shopping list.` }
      }
      return { success: false, message: `\n\n⚠️ I couldn't add "${cmd.name}" to your shopping list.` }
    }

    // -----------------------------------------------------------------------
    // REMOVE SHOPPING ITEM (mark purchased)
    // -----------------------------------------------------------------------
    case 'remove_shopping_item': {
      const item = await findShoppingItemByName(ctx, cmd.item_name)
      if (!item) return { success: false, message: `\n\n⚠️ I couldn't find "${cmd.item_name}" in your shopping list.` }

      const r = await callApi(ctx, '/api/shopping-list', 'PATCH', { id: item.id, isPurchased: true })
      if (r.ok) return { success: true, message: `\n\n✅ Marked "${item.name}" as purchased.` }
      return { success: false, message: `\n\n⚠️ I couldn't mark "${item.name}" as purchased.` }
    }

    default:
      return { success: false, message: '' }
  }
}

// ---------------------------------------------------------------------------
// High-level: process all commands in a reply
// ---------------------------------------------------------------------------

/**
 * Parse all [LIFEBOARD_CMD] blocks from an AI reply, execute each one,
 * and return the cleaned reply with confirmation messages appended.
 */
export async function processReplyCommands(
  reply: string,
  ctx: CommandContext,
): Promise<{ cleanReply: string; createdTask?: any; commandsExecuted: boolean }> {
  const commands = parseCommands(reply)

  if (commands.length === 0) {
    return { cleanReply: reply, commandsExecuted: false }
  }

  // Strip all command blocks first
  let cleanReply = stripCommandBlocks(reply)
  let createdTask: any | undefined
  let anySucceeded = false

  // Execute each command and collect confirmations
  for (const cmd of commands) {
    const result = await executeCommand(cmd, ctx)
    cleanReply += result.message
    if (result.success) anySucceeded = true
    if (result.createdTask && !createdTask) {
      createdTask = result.createdTask
    }
  }

  return { cleanReply, createdTask, commandsExecuted: anySucceeded }
}
