import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { buildChatContext } from '@/lib/chat-context'
import { getRateLimitKey, realtimeLimiter } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Voices accepted by the OpenAI Realtime API (GA, including marin/cedar). */
const OPENAI_REALTIME_VOICES = new Set([
  'alloy', 'ash', 'ballad', 'cedar', 'coral', 'echo', 'marin', 'sage', 'shimmer', 'verse',
])

/**
 * The chat settings panel stores Chatterbox Turbo voice names (used by the
 * Replicate TTS path). OpenAI Realtime rejects those, so map each Chatterbox
 * voice to its closest OpenAI equivalent (inverse of VOICE_MAP in
 * lib/replicate/client.ts, plus nearest matches for the unmapped voices).
 */
const CHATTERBOX_TO_OPENAI: Record<string, string> = {
  Chloe: 'alloy',
  Ethan: 'ash',
  Evelyn: 'ballad',
  Madison: 'coral',
  Gordon: 'echo',
  Laura: 'sage',
  Anaya: 'shimmer',
  Brian: 'verse',
  Abigail: 'coral',
  Aaron: 'ash',
  // Remaining Chatterbox voices — nearest by character
  Andy: 'ash',
  Archer: 'echo',
  Dylan: 'verse',
  Emmanuel: 'echo',
  Gavin: 'ash',
  Ivan: 'echo',
  Lucy: 'shimmer',
  Marisol: 'coral',
  Meera: 'sage',
  Walter: 'echo',
}

/** Resolve any stored voice name to one OpenAI Realtime accepts */
function resolveRealtimeVoice(requested: string | undefined): string {
  const voice = requested || process.env.TTS_VOICE || 'marin'
  if (OPENAI_REALTIME_VOICES.has(voice)) return voice
  return CHATTERBOX_TO_OPENAI[voice] || 'marin'
}

/**
 * Native tool definitions mirroring the LifeboardCommand union in
 * chat-commands.ts (plus refresh_context). The client executes each call via
 * POST /api/chat/execute-command, so `name` must equal the command `action`
 * and parameter shapes must satisfy executeCommandSchema in validations.ts.
 */
const REALTIME_TOOLS = [
  {
    type: 'function',
    name: 'create_task',
    description: "Create a new task on the user's dashboard. Use whenever the user asks to add a task, a to-do, or a reminder to do something.",
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The task text, without the word "task"' },
        due_date: { type: 'string', description: 'Due date as YYYY-MM-DD, if the user gave one' },
        hour_slot: { type: 'integer', minimum: 0, maximum: 23, description: 'Hour of day 0-23 if a time was given (e.g. 3pm = 15)' },
        bucket: { type: 'string', description: 'Bucket/category name if clearly implied (e.g. Work, Personal, Household)' },
      },
      required: ['content'],
    },
  },
  {
    type: 'function',
    name: 'complete_task',
    description: 'Mark an existing task as done. Use the task name exactly as it appears in the dashboard context.',
    parameters: {
      type: 'object',
      properties: {
        task_name: { type: 'string', description: 'Name of the task to complete, as shown in the dashboard context' },
      },
      required: ['task_name'],
    },
  },
  {
    type: 'function',
    name: 'delete_task',
    description: 'Delete an existing task. Only when the user explicitly asks to delete/remove a task (not complete it).',
    parameters: {
      type: 'object',
      properties: {
        task_name: { type: 'string', description: 'Name of the task to delete, as shown in the dashboard context' },
      },
      required: ['task_name'],
    },
  },
  {
    type: 'function',
    name: 'reschedule_task',
    description: 'Move an existing task to a different date and/or time.',
    parameters: {
      type: 'object',
      properties: {
        task_name: { type: 'string', description: 'Name of the task to move, as shown in the dashboard context' },
        new_due_date: { type: 'string', description: 'New due date as YYYY-MM-DD' },
        hour_slot: { type: 'integer', minimum: 0, maximum: 23, description: 'New hour of day 0-23, if a time was given' },
      },
      required: ['task_name', 'new_due_date'],
    },
  },
  {
    type: 'function',
    name: 'edit_task',
    description: "Change an existing task's text, date, time, or bucket.",
    parameters: {
      type: 'object',
      properties: {
        task_name: { type: 'string', description: 'Current name of the task, as shown in the dashboard context' },
        new_content: { type: 'string', description: 'Updated task text, if the user wants it renamed' },
        due_date: { type: 'string', description: 'Updated due date as YYYY-MM-DD' },
        hour_slot: { type: 'integer', minimum: 0, maximum: 23, description: 'Updated hour of day 0-23' },
        bucket: { type: 'string', description: 'Updated bucket/category name' },
      },
      required: ['task_name'],
    },
  },
  {
    type: 'function',
    name: 'add_calendar_event',
    description: "Add an event to the user's calendar (meetings, appointments, anything with a date, unlike tasks which are to-dos).",
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title' },
        date: { type: 'string', description: 'Event date as YYYY-MM-DD' },
        time: { type: 'string', description: 'Start time as HH:MM (24-hour), omit for all-day events' },
        duration_minutes: { type: 'integer', minimum: 1, maximum: 1440, description: 'Duration in minutes, if given' },
        all_day: { type: 'boolean', description: 'True if this is an all-day event' },
        bucket: { type: 'string', description: 'Bucket/category name if clearly implied' },
        description: { type: 'string', description: 'Extra details, if given' },
      },
      required: ['title', 'date'],
    },
  },
  {
    type: 'function',
    name: 'add_shopping_item',
    description: "Add an item to the user's shopping list.",
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Item name' },
        quantity: { type: 'string', description: 'Amount, e.g. "2" or "1 dozen", if given' },
        bucket: { type: 'string', description: 'Bucket/category name if clearly implied' },
        notes: { type: 'string', description: 'Extra details, if given' },
      },
      required: ['name'],
    },
  },
  {
    type: 'function',
    name: 'remove_shopping_item',
    description: 'Remove an item from the shopping list. Use the item name exactly as it appears in the dashboard context.',
    parameters: {
      type: 'object',
      properties: {
        item_name: { type: 'string', description: 'Name of the item to remove, as shown in the dashboard context' },
      },
      required: ['item_name'],
    },
  },
  {
    type: 'function',
    name: 'refresh_context',
    description: "Fetch the user's current dashboard state (tasks, calendar, shopping list). Call before answering questions about current state if it may have changed since the conversation started.",
    parameters: { type: 'object', properties: {} },
  },
]

function buildInstructions(todayIso: string, currentYear: string, systemContext: string): string {
  return `You are Lifeboard's voice assistant, embedded in the user's personal dashboard. Today's date is ${todayIso}.

Speaking style: this is a spoken conversation. Keep replies to one or two short sentences unless the user asks you to elaborate. Speak naturally — never read out JSON, markdown, IDs, or tool syntax.

Actions: when the user asks to create, complete, delete, reschedule, or edit a task, add a calendar event, or change the shopping list, call the matching tool. Never claim an action happened without calling its tool. After a tool returns, confirm the outcome in one short sentence (or relay the error).
- Normalize natural dates ("tomorrow", "next Friday") to YYYY-MM-DD in the user's local timezone; always use year ${currentYear} unless the user explicitly says another year.
- Convert spoken times to an integer hour_slot from 0 (12am) to 23 (11pm).
- When completing, deleting, or editing, use task/item names exactly as they appear in the dashboard state below.${systemContext ? `\n\nCurrent dashboard state:\n${systemContext}` : ''}`
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const rateLimitKey = getRateLimitKey(req, user.id)
  const rateLimited = realtimeLimiter.check(rateLimitKey)
  if (rateLimited) return rateLimited

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })
  }

  const { voice } = (await req.json().catch(() => ({}))) as { voice?: string }
  const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime'

  // Dashboard context makes the session aware of current tasks/calendar/
  // shopping. Non-fatal: a context failure should not block voice chat.
  const { systemContext } = await buildChatContext(req).catch((error) => {
    console.error('Failed to build realtime context:', error instanceof Error ? error.message : String(error))
    return { systemContext: '', userId: null }
  })

  const todayIso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  const currentYear = todayIso.slice(0, 4)

  const resp = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': user.id,
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model,
        instructions: buildInstructions(todayIso, currentYear, systemContext),
        tools: REALTIME_TOOLS,
        tool_choice: 'auto',
        audio: {
          input: {
            transcription: { model: 'gpt-4o-mini-transcribe' },
            turn_detection: { type: 'semantic_vad' },
          },
          output: { voice: resolveRealtimeVoice(voice) },
        },
      },
    }),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    console.error('Realtime session create failed:', resp.status, text)
    return NextResponse.json({ error: 'Failed to create realtime session' }, { status: 500 })
  }

  const data = await resp.json()
  const clientSecret: string | undefined = data?.value
  if (!clientSecret) {
    return NextResponse.json({ error: 'No client secret in response' }, { status: 500 })
  }

  return NextResponse.json({ client_secret: clientSecret, model })
}, 'POST /api/openai/realtime-session')
