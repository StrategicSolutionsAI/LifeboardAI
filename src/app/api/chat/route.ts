import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { runGPT5Pro } from '@/lib/replicate/client'
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

// Supabase-backed task creation (for users without Todoist)
async function createSupabaseTask(req: NextRequest, payload: { content: string; due_date?: string | null; hour_slot?: number; bucket?: string }) {
  try {
    const supabase = supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, reason: 'not_authenticated' as const }

    // Normalize hour_slot to hour_slot display string on API layer via our internal tasks endpoint
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
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('Supabase task create failed', res.status, (txt || '').slice(0, 200))
      return { ok: false as const, status: res.status }
    }
    const json = await res.json()
    return { ok: true as const, task: json.task }
  } catch (e) {
    console.error('Supabase task create exception', e)
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

    // Fetch comprehensive user context
    const prefs = await getUserPreferencesServer()
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`
    const today = new Date().toISOString().split('T')[0]

    let systemContext = ''
    if (prefs) {
      // Gather widget metadata
      const bucketSummary = Object.entries(prefs.widgets_by_bucket).map(([b, w]: [string, any[]]) => `${b}: ${w.map(x => x.name || x.type || 'widget').join(', ')}`).join('; ')

      // Map to hold comprehensive app data
      const contextData: {
        tasks?: any[]
        calendar?: any[]
        shopping?: any[]
        steps?: number
      } = {}

      // Fetch tasks for today and upcoming
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
        console.error('Failed fetching tasks for chat context', err)
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
        console.error('Failed fetching calendar for chat context', err)
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
        console.error('Failed fetching shopping list for chat context', err)
      }

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
          console.error(`Failed fetching ${stepsDataSource} metrics for chat context`, err)
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

    // Enhanced instruction with full app context awareness
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

    // Use GPT-5 Pro via Replicate
    const gpt5Messages = [
      { role: 'system' as const, content: lifeboardInstruction },
      ...(systemContext ? [{ role: 'system' as const, content: systemContext }] : []),
      ...messages.map(({ role, content }) => ({ role: role as 'user' | 'assistant', content }))
    ]

    let reply: string | undefined
    try {
      console.log('🤖 Attempting GPT-5 Pro via Replicate...')
      console.log('Message count:', gpt5Messages.length)
      console.log('Replicate token present:', !!process.env.REPLICATE_API_TOKEN)
      
      const startTime = Date.now()
      reply = await runGPT5Pro({
        messages: gpt5Messages,
        max_tokens: 1024,
        temperature: 0.7,
      })
      const elapsed = Date.now() - startTime
      console.log(`✅ GPT-5 Pro response received in ${elapsed}ms:`, reply.substring(0, 100))
    } catch (error) {
      console.error('❌ GPT-5 Pro error:', error)
      console.error('Error details:', error instanceof Error ? error.message : String(error))
      console.error('Error type:', typeof error)
      console.error('Error keys:', error ? Object.keys(error) : 'null')
      try {
        const fallbackStart = Date.now()
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: gpt5Messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
          max_tokens: 1024,
          temperature: 0.7,
        })
        reply = completion.choices[0]?.message?.content ?? undefined
        console.log(`✅ OpenAI fallback responded in ${Date.now() - fallbackStart}ms`)
      } catch (fallbackErr) {
        console.error('❌ OpenAI fallback error:', fallbackErr)
        reply = "I'm currently experiencing technical difficulties. The AI service is taking longer than expected to respond. Please try again in a moment."
      }
    }
    if (!reply) {
      reply = "I'm currently experiencing technical difficulties. The AI service is taking longer than expected to respond. Please try again in a moment."
    }

    // Detect and execute a task creation command if present
    // Allow command blocks that span multiple lines
    const cmdMatch = (process.env.LIFEBOARD_TASK_CMDS === 'false') ? null : reply.match(/\[LIFEBOARD_CMD\]([\s\S]*?)\[\/LIFEBOARD_CMD\]/)
    let createdTask: any | undefined

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
          // Try direct Todoist create first (fast path), then internal API, then Supabase fallback
          let created: any | undefined
          const direct = await createTodoistTaskDirect(req, { content: cmd.content, due_date: dueDate, hour_slot: (typeof cmd.hour_slot === 'number' ? cmd.hour_slot : undefined), bucket: cmd.bucket || undefined })
          if (direct.ok) {
            created = (direct as any).task
          } else {
            const viaApi = await createTodoistTaskViaApi(req, { content: cmd.content, due_date: dueDate, hour_slot: (typeof cmd.hour_slot === 'number' ? cmd.hour_slot : undefined), bucket: cmd.bucket || undefined })
            if (viaApi.ok) {
              created = (viaApi as any).task
            } else {
              // Fallback to Supabase task if Todoist not connected
              const supa = await createSupabaseTask(req, { content: cmd.content, due_date: dueDate || null, hour_slot: (typeof cmd.hour_slot === 'number' ? cmd.hour_slot : undefined), bucket: cmd.bucket || undefined })
              if (supa.ok) created = (supa as any).task
            }
          }
          if (created) {
            createdTask = created
            reply = reply.replace(cmdMatch[0], `\n\n✅ I added “${cmd.content}”${dueDate ? ` for ${dueDate}` : ''}.`)
          } else {
            // Set a helpful message; auth failure will be handled by API route status
            reply = reply.replace(cmdMatch[0], `\n\n⚠️ I couldn't create the task right now.`)
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
          // Try Todoist, then Supabase fallback
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
