import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { runGemini, runWhisper, runTTS } from '@/lib/replicate/client'
import { getUserPreferencesServer } from '@/lib/user-preferences-server'
import { supabaseServer } from '@/utils/supabase/server'
import { getCommandsPrompt, processReplyCommands } from '@/lib/chat-commands'

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
    // Expect multipart/form-data with a field named 'audio'
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    if (!audioFile) {
      return NextResponse.json({ error: 'Missing audio file' }, { status: 400 })
    }

    const requestedVoice = (formData.get('voice') as string | null) || undefined
    const requestedSpeedRaw = (formData.get('speed') as string | null)
    const requestedSpeed = requestedSpeedRaw ? Number(requestedSpeedRaw) : undefined

    // Transcribe audio to text via Whisper on Replicate
    const buf = Buffer.from(await audioFile.arrayBuffer())
    const transcript = await runWhisper({ audio: buf })
    if (!transcript) {
      return NextResponse.json({ error: 'Empty transcription' }, { status: 422 })
    }

    // Build comprehensive system context (mirror the text chat route)
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`
    const today = new Date().toISOString().split('T')[0]

    let systemContext = ''
    const supabase = supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

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

        if (user) {
          const [tasksResult, calendarResult, shoppingResult] = await Promise.all([
            supabase
              .from('lifeboard_tasks')
              .select('id, content, completed, due_date, start_date, hour_slot, bucket, created_at')
              .eq('user_id', user.id)
              .eq('completed', false)
              .order('created_at', { ascending: false })
              .limit(50),
            supabase
              .from('calendar_events')
              .select('id, title, description, start_date, end_date, hour_slot, all_day, bucket')
              .eq('user_id', user.id)
              .gte('start_date', today)
              .order('start_date', { ascending: true })
              .limit(20),
            supabase
              .from('shopping_list_items')
              .select('id, name, quantity, bucket, is_purchased')
              .eq('user_id', user.id)
              .eq('is_purchased', false)
              .order('created_at', { ascending: true })
              .limit(30),
          ])

          if (tasksResult.data) {
            contextData.tasks = tasksResult.data.map(row => ({
              content: row.content,
              due: row.due_date ? { date: row.due_date } : row.start_date ? { date: row.start_date } : undefined,
              bucket: row.bucket || undefined,
            }))
          }
          if (calendarResult.data) contextData.calendar = calendarResult.data
          if (shoppingResult.data) {
            contextData.shopping = shoppingResult.data.map(row => ({
              name: row.name,
              quantity: row.quantity,
              bucket: row.bucket,
            }))
          }
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

    // Build system prompt with all available commands
    const todayIso = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)
    const currentYear = todayIso.slice(0,4)
    const lifeboardInstruction = getCommandsPrompt(todayIso, currentYear)

    // Ask the assistant using transcript as the user message
    const geminiMessages = [
      ...(systemContext ? [{ role: 'system' as const, content: systemContext }] : []),
      { role: 'user' as const, content: transcript }
    ]

    let reply: string
    try {
      reply = await runGemini({
        messages: [
          { role: 'system', content: lifeboardInstruction },
          ...geminiMessages,
        ],
        max_tokens: 2048,
        temperature: 0.7,
      })
    } catch (geminiErr) {
      console.error('Gemini 3.1 Pro error (voice):', geminiErr instanceof Error ? geminiErr.message : String(geminiErr))
      // Fall back to OpenAI
      const openai = getOpenAI()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: lifeboardInstruction },
          ...(systemContext ? [{ role: 'system' as const, content: systemContext }] : []),
          { role: 'user', content: transcript },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      })
      reply = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'
    }

    // Execute all commands in the reply (create tasks, complete tasks, add events, etc.)
    let createdTask: any | undefined
    let commandsExecuted = false
    if (user) {
      const cmdResult = await processReplyCommands(reply, {
        supabase,
        userId: user.id,
        req,
        origin,
      })
      reply = cmdResult.cleanReply
      createdTask = cmdResult.createdTask
      commandsExecuted = cmdResult.commandsExecuted
    }

    // Synthesize speech via MiniMax TTS on Replicate
    let audioUrl: string | undefined
    try {
      const ttsFileUrl = await runTTS({
        text: reply,
        voice: requestedVoice || process.env.TTS_VOICE || 'alloy',
        speed: typeof requestedSpeed === 'number' && !Number.isNaN(requestedSpeed) ? requestedSpeed : undefined,
      })
      // Fetch the audio file and convert to base64 data URI (Replicate URLs are temporary)
      const audioRes = await fetch(ttsFileUrl)
      const audioBuf = Buffer.from(await audioRes.arrayBuffer())
      const b64 = audioBuf.toString('base64')
      audioUrl = `data:audio/mpeg;base64,${b64}`
    } catch (e) {
      console.warn('Server TTS failed, falling back to client TTS', e)
    }

    return NextResponse.json({ reply, audioUrl, createdTask, commandsExecuted })
  } catch (err) {
    console.error('Voice chat route error', err)

    // Map common OpenAI quota/auth errors to a structured reply the client can detect
    const message: string = String(err instanceof Error ? err.message : 'Internal error')
    const status = /quota/i.test(message) ? 402 : 500
    const body = /quota/i.test(message)
      ? { reply: 'OpenAI quota exceeded. Please add credits or switch to browser speech.' }
      : { error: 'Internal error' }

    return NextResponse.json(body, { status })
  }
}
