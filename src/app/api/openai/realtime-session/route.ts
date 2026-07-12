import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { buildChatContext } from '@/lib/chat-context'
// Generated from the command catalog — the single source shared with
// executeCommandSchema, so tool names and parameter shapes match what
// /api/chat/execute-command validates by construction.
import { REALTIME_TOOLS } from '@/lib/chat-command-catalog'
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
    return { systemContext: '' }
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

  // GA API: the session and its model are bound to the ephemeral key, so
  // the client only needs the secret.
  return NextResponse.json({ client_secret: clientSecret })
}, 'POST /api/openai/realtime-session')
