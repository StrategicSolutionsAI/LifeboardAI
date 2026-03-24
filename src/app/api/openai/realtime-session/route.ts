import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { getRateLimitKey, realtimeLimiter } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const rateLimitKey = getRateLimitKey(req, user.id)
  const rateLimited = realtimeLimiter.check(rateLimitKey)
  if (rateLimited) return rateLimited

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })
  }

  const { voice } = (await req.json().catch(() => ({}))) as { voice?: string }
  const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview'

  // Build instruction string mirroring /api/chat task-command contract
  const todayIso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  const currentYear = todayIso.slice(0, 4)
  const lifeboardInstruction = `You are embedded in Lifeboard. Today's date is ${todayIso}. If the user asks to add/create a task (e.g., "add a task to call John tomorrow at 3pm in Work"), include ONE command block in addition to your normal reply, exactly in this format on a single line: [LIFEBOARD_CMD]{"action":"create_task","content":"<task text>","due_date":"YYYY-MM-DD","hour_slot":<0-23 optional>,"bucket":"<optional bucket name>"}[/LIFEBOARD_CMD].

Important rules:
- The spoken audio must NOT read or mention the command block. Do not say phrases like "Lifeboard Command". Only speak the natural reply.
- The command block must be plain text (no code fences), on a single line, and use double quotes.
- Normalize natural dates to the user's local timezone and ALWAYS use year ${currentYear} for due_date unless the user explicitly says a different year.
- If a time is given, convert it to an integer hour_slot from 0 (12am) to 23 (11pm).
- If no date is specified but they say "today" or similar, use today's date.
- If a bucket/category is clearly implied (e.g., "Work", "Personal", "Household"), include it in bucket.
- Do not include the word TASK in content.`

  const resp = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice: voice || process.env.TTS_VOICE || 'alloy',
      modalities: ['audio', 'text'],
      turn_detection: { type: 'server_vad' },
      input_audio_transcription: { model: 'gpt-4o-mini-transcribe' },
      instructions: lifeboardInstruction,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    console.error('Realtime session create failed:', resp.status, text)
    return NextResponse.json({ error: 'Failed to create realtime session' }, { status: 500 })
  }

  const data = await resp.json()
  const clientSecret: string | undefined = data?.client_secret?.value
  if (!clientSecret) {
    return NextResponse.json({ error: 'No client_secret in response' }, { status: 500 })
  }

  return NextResponse.json({ client_secret: clientSecret, model })
}, 'POST /api/openai/realtime-session')
