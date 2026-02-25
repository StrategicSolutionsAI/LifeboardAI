import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { toFile } from 'openai/uploads'
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
      console.error('Todoist direct create failed (voice)', resp.status, txt)
      return { ok: false, reason: 'upstream_error' as const, status: resp.status }
    }
    const task = await resp.json()
    return { ok: true as const, task }
  } catch (e) {
    console.error('Todoist direct create exception (voice)', e)
    return { ok: false as const, reason: 'exception' as const }
  }
}

// Prefer internal API to consolidate logic (year fix, formatting)
async function createTodoistTaskViaApi(req: NextRequest, payload: { content: string; due_date?: string | null; hour_slot?: number; bucket?: string }) {
  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`
    const res = await fetch(`${origin}/api/integrations/todoist/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      console.error('Todoist create via API (voice) failed', res.status, txt)
      return { ok: false as const, status: res.status }
    }
    const json = await res.json().catch(() => ({} as any))
    return { ok: true as const, task: json.task }
  } catch (e) {
    console.error('Todoist create via API exception (voice)', e)
    return { ok: false as const }
  }
}

// Supabase-backed task creation fallback
async function createSupabaseTask(req: NextRequest, payload: { content: string; due_date?: string | null; hour_slot?: number; bucket?: string }) {
  try {
    const supabase = supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, reason: 'not_authenticated' as const }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`
    const res = await fetch(`${origin}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') || ''
      },
      body: JSON.stringify({
        content: payload.content,
        due_date: payload.due_date ?? null,
        hour_slot: typeof payload.hour_slot === 'number' ? payload.hour_slot : undefined,
        bucket: payload.bucket
      })
    })
    if (!res.ok) return { ok: false as const, status: res.status }
    const json = await res.json()
    return { ok: true as const, task: json.task }
  } catch (e) {
    console.error('Supabase task create exception (voice)', e)
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

    // Expect multipart/form-data with a field named 'audio'
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    if (!audioFile) {
      return NextResponse.json({ error: 'Missing audio file' }, { status: 400 })
    }

    const requestedVoice = (formData.get('voice') as string | null) || undefined
    const requestedSpeedRaw = (formData.get('speed') as string | null)
    const requestedSpeed = requestedSpeedRaw ? Number(requestedSpeedRaw) : undefined

    // Convert to a File that OpenAI SDK accepts
    const buf = Buffer.from(await audioFile.arrayBuffer())
    const uploadFile = await toFile(buf, audioFile.name || 'voice-message.webm', {
      type: audioFile.type || 'audio/webm',
    })

    // Transcribe audio to text
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: uploadFile,
      // language: 'en', // optionally force language
      // temperature: 0.2,
    })

    const transcript = (transcription.text || '').trim()
    if (!transcript) {
      return NextResponse.json({ error: 'Empty transcription' }, { status: 422 })
    }

    // Build comprehensive system context (mirror the text chat route)
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`
    const today = new Date().toISOString().split('T')[0]

    let systemContext = ''
    try {
      const prefs = await getUserPreferencesServer()
      if (prefs) {
        const bucketSummary = Object.entries(prefs.widgets_by_bucket)
          .map(([b, w]: [string, any[]]) => `${b}: ${w.map(x => x.name || x.type || 'widget').join(', ')}`)
          .join('; ')

        const contextData: {
          tasks?: any[]
          calendar?: any[]
          shopping?: any[]
          steps?: number
        } = {}

        // Fetch tasks
        try {
          const tasksRes = await fetch(`${origin}/api/tasks?all=true&includeCompleted=false`, {
            headers: { cookie: req.headers.get('cookie') || '' },
            cache: 'no-store'
          })
          if (tasksRes.ok) {
            const tasksJson = await tasksRes.json()
            contextData.tasks = tasksJson.tasks || []
          }
        } catch (err) {
          console.error('Failed fetching tasks for voice chat context', err)
        }

        // Fetch calendar events
        try {
          const supabase = supabaseServer()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: events } = await supabase
              .from('calendar_events')
              .select('id, title, description, start_date, end_date, hour_slot, all_day, bucket')
              .eq('user_id', user.id)
              .gte('start_date', today)
              .order('start_date', { ascending: true })
              .limit(20)
            if (events) contextData.calendar = events
          }
        } catch (err) {
          console.error('Failed fetching calendar for voice chat context', err)
        }

        // Fetch shopping list
        try {
          const shoppingRes = await fetch(`${origin}/api/shopping-list`, {
            headers: { cookie: req.headers.get('cookie') || '' },
            cache: 'no-store'
          })
          if (shoppingRes.ok) {
            const shoppingJson = await shoppingRes.json()
            contextData.shopping = shoppingJson.items || []
          }
        } catch (err) {
          console.error('Failed fetching shopping list for voice chat context', err)
        }

        // Detect steps widget and fetch metrics
        let stepsDataSource: 'fitbit' | 'googlefit' | null = null
        for (const widgets of Object.values(prefs.widgets_by_bucket)) {
          for (const w of widgets as any[]) {
            if ((w as any).id === 'steps') {
              const ds = (w as any).dataSource ?? 'fitbit'
              stepsDataSource = ds === 'googlefit' ? 'googlefit' : 'fitbit'
              break
            }
          }
          if (stepsDataSource) break
        }

        if (stepsDataSource) {
          try {
            const metricsUrl = `${origin}/api/integrations/${stepsDataSource}/metrics?date=${today}`
            const metricsRes = await fetch(metricsUrl, {
              headers: { cookie: req.headers.get('cookie') || '' },
              cache: 'no-store'
            })
            if (metricsRes.ok) {
              const metricsJson = await metricsRes.json()
              if (typeof metricsJson.steps === 'number') {
                contextData.steps = metricsJson.steps
              }
            }
          } catch (err) {
            console.error(`Failed fetching ${stepsDataSource} metrics for voice chat context`, err)
          }
        }

        // Build comprehensive context string
        const contextParts = [
          `Life buckets: ${prefs.life_buckets.join(', ')}`,
          `Widgets: ${bucketSummary}`
        ]

        if (contextData.tasks && contextData.tasks.length > 0) {
          const taskSummary = contextData.tasks
            .slice(0, 15)
            .map((t: any) => `- ${t.content}${t.due?.date ? ` (due: ${t.due.date})` : ''}${t.bucket ? ` [${t.bucket}]` : ''}`)
            .join('\n')
          contextParts.push(`\n\nCurrent Tasks (${contextData.tasks.length}):\n${taskSummary}${contextData.tasks.length > 15 ? '\n... and more' : ''}`)
        }

        if (contextData.calendar && contextData.calendar.length > 0) {
          const calSummary = contextData.calendar
            .slice(0, 10)
            .map((e: any) => `- ${e.title}${e.start_date ? ` (${e.start_date})` : ''}${e.bucket ? ` [${e.bucket}]` : ''}`)
            .join('\n')
          contextParts.push(`\n\nUpcoming Calendar Events (${contextData.calendar.length}):\n${calSummary}${contextData.calendar.length > 10 ? '\n... and more' : ''}`)
        }

        if (contextData.shopping && contextData.shopping.length > 0) {
          const shopSummary = contextData.shopping
            .slice(0, 10)
            .map((i: any) => `- ${i.name}${i.quantity ? ` (${i.quantity})` : ''}${i.bucket ? ` [${i.bucket}]` : ''}`)
            .join('\n')
          contextParts.push(`\n\nShopping List (${contextData.shopping.length}):\n${shopSummary}${contextData.shopping.length > 10 ? '\n... and more' : ''}`)
        }

        if (contextData.steps !== undefined) {
          contextParts.push(`\n\nToday's Steps: ${contextData.steps}`)
        }

        systemContext = `System: ${contextParts.join('\n')}`
      }
    } catch (e) {
      console.error('Failed to build voice chat system context', e)
    }

    // Ask the assistant, using transcript as the user message
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...(systemContext ? [{ role: 'system' as const, content: systemContext }] : []),
      { role: 'user', content: transcript }
    ]

    const todayIso = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)
    const currentYear = todayIso.slice(0,4)
    const lifeboardInstruction = `You are Lifeboard's AI assistant with full access to the user's dashboard. Today's date is ${todayIso}.

CONTEXT AWARENESS:
- You can see all tasks, calendar events, shopping lists, and dashboard widgets
- Reference specific items when answering questions (e.g., "I see you have 'Call dentist' scheduled for tomorrow")
- Provide personalized insights based on their actual data
- Help them understand patterns and prioritize work

TASK CREATION:
When the user asks to add/create a task, include ONE command block in addition to your natural reply:
[LIFEBOARD_CMD]{"action":"create_task","content":"<task text>","due_date":"YYYY-MM-DD","hour_slot":<0-23 optional>,"bucket":"<optional bucket name>"}[/LIFEBOARD_CMD]

Rules:
- Normalize dates to user's local timezone, use year ${currentYear} unless specified
- Convert times to hour_slot (0=12am to 23=11pm)
- Infer bucket from context if mentioned (Work, Personal, Health, etc.)
- Do not include the word "TASK" in content
- Keep your natural reply separate from the command block

CAPABILITIES:
- Answer questions about their schedule, tasks, and shopping list
- Provide summaries and insights
- Help prioritize and organize
- Suggest optimizations based on their data
- Be conversational and helpful`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: lifeboardInstruction },
        ...messages,
      ],
      max_tokens: 1024,
      temperature: 0.7,
    })

    let reply = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'

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

    // Detect and execute task creation command
    // Allow command blocks that span multiple lines
    const cmdMatch = (process.env.LIFEBOARD_TASK_CMDS === 'false') ? null : reply.match(/\[LIFEBOARD_CMD\]([\s\S]*?)\[\/LIFEBOARD_CMD\]/)
    let createdTask: any | undefined
    if (cmdMatch) {
      try {
        const cmd = JSON.parse(cmdMatch[1]) as { action?: string; content?: string; due_date?: string; hour_slot?: number; bucket?: string }
        if (cmd.action === 'create_task' && cmd.content) {
          // Fallback: if no due_date provided, infer from the transcript (today/tomorrow)
          let dueDate = cmd.due_date && /^\d{4}-\d{2}-\d{2}$/.test(cmd.due_date) ? cmd.due_date : null
          try {
            if (!dueDate) {
              const txt = transcript.toLowerCase()
              const now = new Date()
              if (txt.includes('today') || txt.includes('tonight')) {
                dueDate = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10)
              } else if (txt.includes('tomorrow')) {
                const t = new Date(now)
                t.setDate(t.getDate() + 1)
                dueDate = new Date(t.getTime() - t.getTimezoneOffset()*60000).toISOString().slice(0,10)
              }
            } else {
              // If model emitted a past year and user didn't specify a year, bump to current year
              const containsYear = /\b\d{4}\b/.test(transcript)
              const yr = Number(dueDate.slice(0,4))
              const nowYr = new Date().getFullYear()
              if (!containsYear && yr < nowYr) {
                dueDate = `${nowYr}${dueDate.slice(4)}`
              }
            }
          } catch {}
          // Try Todoist; then internal API; then Supabase fallback
          const direct = await createTodoistTaskDirect(req, { content: cmd.content, due_date: dueDate, hour_slot: (typeof cmd.hour_slot === 'number' ? cmd.hour_slot : undefined), bucket: cmd.bucket || undefined })
          if (direct.ok) {
            createdTask = (direct as any).task
            reply = reply.replace(cmdMatch[0], `\n\n✅ I added “${cmd.content}”${dueDate ? ` for ${dueDate}` : ''}.`)
          } else {
            const viaApi = await createTodoistTaskViaApi(req, { content: cmd.content, due_date: dueDate, hour_slot: (typeof cmd.hour_slot === 'number' ? cmd.hour_slot : undefined), bucket: cmd.bucket || undefined })
            if (viaApi.ok) {
              createdTask = (viaApi as any).task
              reply = reply.replace(cmdMatch[0], `\n\n✅ I added “${cmd.content}”${dueDate ? ` for ${dueDate}` : ''}.`)
            } else {
              const supa = await createSupabaseTask(req, { content: cmd.content, due_date: dueDate || null, hour_slot: (typeof cmd.hour_slot === 'number' ? cmd.hour_slot : undefined), bucket: cmd.bucket || undefined })
              if (supa.ok) {
                createdTask = (supa as any).task
                reply = reply.replace(cmdMatch[0], `\n\n✅ I added “${cmd.content}”${dueDate ? ` for ${dueDate}` : ''}.`)
              } else {
                reply = reply.replace(cmdMatch[0], `\n\n⚠️ I couldn't create the task right now.`)
              }
            }
          }
        }
      } catch {
        reply = reply.replace(cmdMatch[0], '')
      }
    }

    if (!createdTask) {
      const parsed = parseTaskFromText(transcript)
      if (parsed) {
        try {
          const direct2 = await createTodoistTaskDirect(req, { content: parsed.content, due_date: parsed.due_date, hour_slot: parsed.hour_slot, bucket: parsed.bucket })
          if (direct2.ok) {
            createdTask = (direct2 as any).task
            reply += `\n\n✅ I added “${parsed.content}”${parsed.due_date ? ` for ${parsed.due_date}` : ''}.`
          } else {
            const viaApi = await createTodoistTaskViaApi(req, { content: parsed.content, due_date: parsed.due_date, hour_slot: parsed.hour_slot, bucket: parsed.bucket })
            if (viaApi.ok) {
              createdTask = (viaApi as any).task
              reply += `\n\n✅ I added “${parsed.content}”${parsed.due_date ? ` for ${parsed.due_date}` : ''}.`
            } else {
              const supa = await createSupabaseTask(req, { content: parsed.content, due_date: parsed.due_date || null, hour_slot: parsed.hour_slot, bucket: parsed.bucket })
              if (supa.ok) {
                createdTask = (supa as any).task
                reply += `\n\n✅ I added “${parsed.content}”${parsed.due_date ? ` for ${parsed.due_date}` : ''}.`
              }
            }
          }
        } catch {}
      }
    }

    // Try to synthesize speech on the server for consistent voice
    let audioUrl: string | undefined
    try {
      const speech = await openai.audio.speech.create({
        model: 'gpt-4o-mini-tts',
        voice: (requestedVoice as any) || (process.env.TTS_VOICE as any) || 'alloy',
        input: reply,
        response_format: 'mp3',
        ...(typeof requestedSpeed === 'number' && !Number.isNaN(requestedSpeed) ? { speed: requestedSpeed } : {}),
      })
      const buf = Buffer.from(await speech.arrayBuffer())
      const b64 = buf.toString('base64')
      audioUrl = `data:audio/mpeg;base64,${b64}`
    } catch (e) {
      console.warn('Server TTS failed, falling back to client TTS', e)
    }

    return NextResponse.json({ reply, audioUrl, createdTask })
  } catch (err: any) {
    console.error('Voice chat route error', err)

    // Map common OpenAI quota/auth errors to a structured reply the client can detect
    const message: string = String(err?.message || 'Internal error')
    const status = /quota/i.test(message) ? 402 : 500
    const body = /quota/i.test(message)
      ? { reply: 'OpenAI quota exceeded. Please add credits or switch to browser speech.' }
      : { error: 'Internal error' }

    return NextResponse.json(body, { status })
  }
}
