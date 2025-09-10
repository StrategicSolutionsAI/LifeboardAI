import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getUserPreferencesServer } from '@/lib/user-preferences-server'
import { supabaseServer } from '@/utils/supabase/server'

async function createTodoistTaskDirect(req: NextRequest, payload: { content: string; due_date?: string | null; hour_slot?: number; bucket?: string }) {
  try {
    const supabase = supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, reason: 'not_authenticated' as const }
    const { data: integration } = await supabase
      .from('user_integrations')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provider', 'todoist')
      .maybeSingle()
    if (!integration?.access_token) return { ok: false, reason: 'not_connected' as const }

    const body: Record<string, any> = { content: payload.content }
    if (payload.due_date) body.due_date = payload.due_date
    const meta: Record<string, any> = {}
    if (typeof payload.hour_slot === 'number') {
      // Normalize to app's convention: 'hour-<7AM..9PM>'
      const h = Math.max(0, Math.min(23, payload.hour_slot))
      const display = (() => {
        if (h === 0) return '12AM'
        if (h < 12) return `${h}AM`
        if (h === 12) return '12PM'
        return `${h - 12}PM`
      })()
      meta.hourSlot = `hour-${display}`
    }
    if (payload.bucket) meta.bucket = payload.bucket
    if (Object.keys(meta).length > 0) body.description = `[LIFEBOARD_META]${JSON.stringify(meta)}[/LIFEBOARD_META]`

    const resp = await fetch('https://api.todoist.com/rest/v2/tasks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      console.error('Todoist direct create failed', { status: resp.status, bodyPreview: (txt || '').slice(0, 200) })
      return { ok: false, reason: 'upstream_error' as const, status: resp.status }
    }
    const task = await resp.json()
    console.log('Todoist direct create ok', { id: task?.id, due: task?.due?.date })
    return { ok: true as const, task }
  } catch (e) {
    console.error('Todoist direct create exception', e)
    return { ok: false as const, reason: 'exception' as const }
  }
}

// Prefer internal API route so all creation logic stays consistent
async function createTodoistTaskViaApi(req: NextRequest, payload: { content: string; due_date?: string | null; hour_slot?: number; bucket?: string }) {
  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`
    const res = await fetch(`${origin}/api/integrations/todoist/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // forward cookies so the route can authenticate the user
        cookie: req.headers.get('cookie') || ''
      },
      body: JSON.stringify({
        content: payload.content,
        due_date: payload.due_date ?? null,
        hour_slot: typeof payload.hour_slot === 'number' ? payload.hour_slot : undefined,
        bucket: payload.bucket
      })
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('Todoist create via API failed', res.status, txt)
      return { ok: false as const, status: res.status }
    }
    const json = await res.json().catch(() => ({} as any))
    return { ok: true as const, task: json.task }
  } catch (e) {
    console.error('Todoist create via API exception', e)
    return { ok: false as const }
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }
  return new OpenAI({ apiKey })
}

export async function POST(req: NextRequest) {
  try {
    const openai = getOpenAI()
    const body = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      tts?: { voice?: string; speed?: number }
    }
    const { messages } = body

    // Ensure at least one user message
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 })
    }

    // Fetch user preferences to give Claude context about tabs and widgets
    const prefs = await getUserPreferencesServer()

    let systemContext = ''
if (prefs) {
  // Gather widget metadata
  const bucketSummary = Object.entries(prefs.widgets_by_bucket).map(([b, w]: [string, any[]]) => `${b}: ${w.map(x => x.name || x.type || 'widget').join(', ')}`).join('; ')

  // Map to hold dynamic data values we can fetch quickly
  const dynamicData: Record<string, string | number> = {}

  // Detect a steps widget and its data source
  let stepsDataSource: 'fitbit' | 'googlefit' | null = null
  for (const widgets of Object.values(prefs.widgets_by_bucket)) {
    for (const w of widgets as any[]) {
      if (w.id === 'steps') {
        const ds = (w as any).dataSource ?? 'fitbit'
        stepsDataSource = ds === 'googlefit' ? 'googlefit' : 'fitbit'
        break
      }
    }
    if (stepsDataSource) break
  }

  if (stepsDataSource) {
    try {
      const today = new Date().toISOString().split('T')[0]
      const metricsUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/integrations/${stepsDataSource}/metrics?date=${today}`
      const metricsRes = await fetch(metricsUrl, {
        headers: {
          cookie: req.headers.get('cookie') || ''
        },
        cache: 'no-store'
      })
      if (metricsRes.ok) {
        const metricsJson = await metricsRes.json()
        if (typeof metricsJson.steps === 'number') {
          dynamicData['daily_steps'] = metricsJson.steps
        }
      }
    } catch (err) {
      console.error(`Failed fetching ${stepsDataSource} metrics for chat context`, err)
    }
  }

  const dynamicString = Object.keys(dynamicData).length > 0 ? ` Current data: ${Object.entries(dynamicData).map(([k,v]) => `${k}: ${v}`).join(', ')}.` : ''

  systemContext = `System: The user has the following life buckets (tabs): ${prefs.life_buckets.join(', ')}. Widgets per bucket: ${bucketSummary}.${dynamicString}`
}

    // Create OpenAI messages format
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...(systemContext ? [{ role: 'system' as const, content: systemContext }] : []),
      ...messages.map(({ role, content }) => ({ role: role as 'user' | 'assistant', content }))
    ]

    // Instruction to optionally emit a command block for task creation
    const todayIso = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)
    const currentYear = todayIso.slice(0,4)
    const lifeboardInstruction = `You are embedded in Lifeboard. Today's date is ${todayIso}. If the user asks to add/create a task (e.g., "add a task to call John tomorrow at 3pm in Work"), include ONE command block in addition to your normal reply, exactly in this format on a single line: [LIFEBOARD_CMD]{"action":"create_task","content":"<task text>","due_date":"YYYY-MM-DD","hour_slot":<0-23 optional>,"bucket":"<optional bucket name>"}[/LIFEBOARD_CMD].
Normalize natural dates to the user's local timezone and ALWAYS use year ${currentYear} for due_date unless the user explicitly says a different year. If a time is given, convert it to an integer hour_slot from 0 (12am) to 23 (11pm). If no date is specified but they say "today" or similar, use today's date. If a bucket/category is clearly implied (e.g., "Work", "Personal"), include it in bucket. Do not include the word TASK in content. Keep your normal reply natural and separate from the command block.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: lifeboardInstruction },
        ...openaiMessages,
      ],
      max_tokens: 1024,
      temperature: 0.7,
    })

    let reply = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'

    // Detect and execute a task creation command if present
    // Allow command blocks that span multiple lines
    const cmdMatch = (process.env.LIFEBOARD_TASK_CMDS === 'false') ? null : reply.match(/\[LIFEBOARD_CMD\]([\s\S]*?)\[\/LIFEBOARD_CMD\]/)
    let createdTask: any | undefined
    // Helper to resolve origin for internal fetches
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`

    // Fallback parser for natural language like "add a task to call John today at 3pm"
    const parseTaskFromText = (text: string): { content: string; due_date: string | null; hour_slot?: number; bucket?: string } | null => {
      const raw = (text || '').toLowerCase()
      const triggers = /(add\s+(a\s+)?task|add\s+to\s+tasks|create\s+task)/i
      if (!triggers.test(raw)) return null

      let due: string | null = null
      const now = new Date()
      if (/\b(today|tonight)\b/i.test(text)) {
        due = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10)
      } else if (/\b(tomorrow)\b/i.test(text)) {
        const t = new Date(now)
        t.setDate(t.getDate() + 1)
        due = new Date(t.getTime() - t.getTimezoneOffset()*60000).toISOString().slice(0,10)
      }

      let hour_slot: number | undefined
      const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
      if (timeMatch) {
        let h = parseInt(timeMatch[1], 10)
        const mer = (timeMatch[3] || '').toLowerCase()
        if (mer === 'pm' && h < 12) h += 12
        if (mer === 'am' && h === 12) h = 0
        if (h >= 0 && h <= 23) hour_slot = h
      } else if (/\btonight\b/i.test(text)) {
        hour_slot = 20
      }

      let bucket: string | undefined
      const bucketMatch = text.match(/\bin\s+(work|personal|health|home|family)\b/i)
      if (bucketMatch) bucket = bucketMatch[1]

      // Strip leading phrases to get content
      let content = text
        .replace(/\b(add\s+(a\s+)?task(\s+to)?|create\s+task)\b/i, '')
        .replace(/\bfor\s+(today|tomorrow|tonight)\b/ig, '')
        .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?/ig, '')
        .replace(/\bin\s+(work|personal|health|home|family)\b/ig, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (!content) return null
      return { content, due_date: due, hour_slot, bucket }
    }

    if (cmdMatch) {
      try {
        const cmd = JSON.parse(cmdMatch[1]) as { action?: string; content?: string; due_date?: string; hour_slot?: number; bucket?: string }
        if (cmd.action === 'create_task' && cmd.content) {
          console.log('CHAT: create_task command detected', { contentPreview: cmd.content.slice(0, 120), due_date: cmd.due_date, hour_slot: cmd.hour_slot, bucket: cmd.bucket })
          // Fallback: if no due_date provided, infer from the latest user message (today/tomorrow). Also fix obviously stale years.
          let dueDate = cmd.due_date && /^\d{4}-\d{2}-\d{2}$/.test(cmd.due_date) ? cmd.due_date : null
          try {
            if (!dueDate) {
              const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content?.toLowerCase?.() || ''
              const now = new Date()
              if (lastUser.includes('today') || lastUser.includes('tonight')) {
                dueDate = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10)
              } else if (lastUser.includes('tomorrow')) {
                const t = new Date(now)
                t.setDate(t.getDate() + 1)
                dueDate = new Date(t.getTime() - t.getTimezoneOffset()*60000).toISOString().slice(0,10)
              }
            } else {
              // If model emitted a past year (e.g., 2023) and the user didn't specify a year, bump to current year
              const lastUserRaw = [...messages].reverse().find(m => m.role === 'user')?.content || ''
              const containsYear = /\b\d{4}\b/.test(lastUserRaw)
              const yr = Number(dueDate.slice(0,4))
              const nowYr = new Date().getFullYear()
              if (!containsYear && yr < nowYr) {
                dueDate = `${nowYr}${dueDate.slice(4)}`
              }
            }
          } catch {}
          // Try direct Todoist create first (fast path), then fall back to internal API
          let created: any | undefined
          const direct = await createTodoistTaskDirect(req, { content: cmd.content, due_date: dueDate, hour_slot: (typeof cmd.hour_slot === 'number' ? cmd.hour_slot : undefined), bucket: cmd.bucket || undefined })
          if (direct.ok) {
            created = (direct as any).task
            console.log('CHAT: direct create succeeded', { id: created?.id })
          } else {
            const viaApi = await createTodoistTaskViaApi(req, { content: cmd.content, due_date: dueDate, hour_slot: (typeof cmd.hour_slot === 'number' ? cmd.hour_slot : undefined), bucket: cmd.bucket || undefined })
            console.log('CHAT: direct create failed; via API status', { ok: viaApi.ok })
            if (viaApi.ok) created = (viaApi as any).task
          }
          if (created) {
            createdTask = created
            reply = reply.replace(cmdMatch[0], `\n\n✅ I added “${cmd.content}”${dueDate ? ` for ${dueDate}` : ''}.`)
          } else {
            // Set a helpful message; auth failure will be handled by API route status
            reply = reply.replace(cmdMatch[0], `\n\n⚠️ Connect Todoist in Integrations to enable task creation.`)
          }
        }
      } catch {
        reply = reply.replace(cmdMatch[0], '')
      }
    }

    // If no explicit command created a task, try a lightweight fallback based on the last user message
    if (!createdTask) {
      const lastUserText = [...messages].reverse().find(m => m.role === 'user')?.content || ''
      const parsed = parseTaskFromText(lastUserText)
      if (parsed) {
        try {
          console.log('CHAT: parsed natural create', parsed)
          // Try direct first, then internal API
          const direct2 = await createTodoistTaskDirect(req, { content: parsed.content, due_date: parsed.due_date, hour_slot: parsed.hour_slot, bucket: parsed.bucket })
          if (direct2.ok) {
            createdTask = (direct2 as any).task
            console.log('CHAT: parsed direct create ok', { id: (createdTask as any)?.id })
            reply += `\n\n✅ I added “${parsed.content}”${parsed.due_date ? ` for ${parsed.due_date}` : ''}.`
          } else {
            const viaApi = await createTodoistTaskViaApi(req, { content: parsed.content, due_date: parsed.due_date, hour_slot: parsed.hour_slot, bucket: parsed.bucket })
            console.log('CHAT: parsed direct failed; via API ok?', viaApi.ok)
            if (viaApi.ok) {
              createdTask = (viaApi as any).task
              reply += `\n\n✅ I added “${parsed.content}”${parsed.due_date ? ` for ${parsed.due_date}` : ''}.`
            }
          }
        } catch {}
      }
    }

    // Optional server-side TTS for consistent assistant voice
    let audioUrl: string | undefined
    try {
      const speech = await openai.audio.speech.create({
        model: 'gpt-4o-mini-tts',
        voice: (body.tts?.voice as any) || (process.env.TTS_VOICE as any) || 'alloy',
        input: reply,
        response_format: 'mp3',
        ...(typeof body.tts?.speed === 'number' ? { speed: body.tts!.speed } : {}),
      })
      const buf = Buffer.from(await speech.arrayBuffer())
      const b64 = buf.toString('base64')
      audioUrl = `data:audio/mpeg;base64,${b64}`
    } catch (e) {
      console.warn('Server TTS failed for /api/chat; returning text only', e)
    }

    return NextResponse.json({ reply, audioUrl, createdTask })
  } catch (err: any) {
    console.error('Chat route error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
