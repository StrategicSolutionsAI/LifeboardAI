import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { runGemini, runTTS } from '@/lib/replicate/client'
import { getUserPreferencesServer } from '@/lib/user-preferences-server'
import { supabaseServer } from '@/utils/supabase/server'
import { handleApiError } from '@/lib/api-error-handler'
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
    const body = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      tts?: { voice?: string; speed?: number }
    }
    const { messages } = body

    // Ensure at least one user message
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 })
    }

    // Fetch comprehensive user context via direct DB queries (not self-calling HTTP)
    const prefs = await getUserPreferencesServer()
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`
    const today = new Date().toISOString().split('T')[0]

    let systemContext = ''
    const supabase = supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (prefs) {
      const bucketSummary = Object.entries(prefs.widgets_by_bucket).map(([b, w]: [string, any[]]) => `${b}: ${w.map(x => x.name || x.type || 'widget').join(', ')}`).join('; ')

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

      // Steps metrics still needs the integration-specific API (has token refresh logic)
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

    // Build system prompt with all available commands
    const todayIso = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)
    const currentYear = todayIso.slice(0,4)
    const lifeboardInstruction = getCommandsPrompt(todayIso, currentYear)

    // Use Gemini 3.1 Pro via Replicate
    const geminiMessages = [
      { role: 'system' as const, content: lifeboardInstruction },
      ...(systemContext ? [{ role: 'system' as const, content: systemContext }] : []),
      ...messages.map(({ role, content }) => ({ role: role as 'user' | 'assistant', content }))
    ]

    let reply: string | undefined
    try {
      reply = await runGemini({
        messages: geminiMessages,
        max_tokens: 2048,
        temperature: 0.7,
      })
    } catch (error) {
      console.error('Gemini 3.1 Pro error:', error instanceof Error ? error.message : String(error))
      try {
        const openai = getOpenAI()
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: geminiMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
          max_tokens: 1024,
          temperature: 0.7,
        })
        reply = completion.choices[0]?.message?.content ?? undefined
      } catch (fallbackErr) {
        console.error('OpenAI fallback error:', fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr))
        reply = "I'm currently experiencing technical difficulties. The AI service is taking longer than expected to respond. Please try again in a moment."
      }
    }
    if (!reply) {
      reply = "I'm currently experiencing technical difficulties. The AI service is taking longer than expected to respond. Please try again in a moment."
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

    // Optional server-side TTS via Chatterbox Turbo on Replicate
    let audioUrl: string | undefined
    try {
      const ttsFileUrl = await runTTS({
        text: reply,
        voice: body.tts?.voice || process.env.TTS_VOICE || 'Chloe',
        speed: typeof body.tts?.speed === 'number' && !Number.isNaN(body.tts.speed) ? body.tts.speed : undefined,
      })
      // Fetch the audio file and convert to base64 data URI (Replicate URLs are temporary)
      const audioRes = await fetch(ttsFileUrl)
      const buf = Buffer.from(await audioRes.arrayBuffer())
      const b64 = buf.toString('base64')
      audioUrl = `data:audio/wav;base64,${b64}`
    } catch (e) {
      console.warn('Server TTS failed for /api/chat; returning text only', e)
    }

    return NextResponse.json({ reply, audioUrl, createdTask, commandsExecuted })
  } catch (err) {
    return handleApiError(err, 'POST /api/chat')
  }
}
