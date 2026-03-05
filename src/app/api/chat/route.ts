import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { runGemini, runTTS } from '@/lib/replicate/client'
import { supabaseServer } from '@/utils/supabase/server'
import { handleApiError } from '@/lib/api-error-handler'
import { getCommandsPrompt, processReplyCommands } from '@/lib/chat-commands'
import { buildChatContext } from '@/lib/chat-context'
import { chatLimiter, getRateLimitKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Module-level singleton — reused across warm invocations
let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
    _openai = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 })
  }
  return _openai
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit before any expensive work (AI calls cost money)
    const rateLimitKey = getRateLimitKey(req)
    const rateLimited = chatLimiter.check(rateLimitKey)
    if (rateLimited) return rateLimited

    const body = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      tts?: { voice?: string; speed?: number }
    }
    const { messages } = body

    // Ensure at least one user message
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 })
    }

    // Fetch comprehensive user context via shared builder (uses Promise.allSettled)
    const { systemContext, userId } = await buildChatContext(req)
    const supabase = supabaseServer()
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`

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
    if (userId) {
      const cmdResult = await processReplyCommands(reply, {
        supabase,
        userId,
        req,
        origin,
      })
      reply = cmdResult.cleanReply
      createdTask = cmdResult.createdTask
      commandsExecuted = cmdResult.commandsExecuted
    }

    // Stream response: send text immediately, then TTS audio when ready
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        // Chunk 1: text reply (sent immediately)
        controller.enqueue(encoder.encode(
          JSON.stringify({ type: 'text', reply, createdTask, commandsExecuted }) + '\n'
        ))

        // Chunk 2: TTS audio (generated in background)
        try {
          const ttsVoice = body.tts?.voice || process.env.TTS_VOICE || 'Chloe'
          console.log(`[TTS] /api/chat: Starting synthesis: voice=${ttsVoice}, text length=${reply.length}`)
          const ttsFileUrl = await runTTS({
            text: reply,
            voice: ttsVoice,
            speed: typeof body.tts?.speed === 'number' && !Number.isNaN(body.tts.speed) ? body.tts.speed : undefined,
          })
          console.log(`[TTS] /api/chat: Got file URL: ${ttsFileUrl.slice(0, 80)}...`)
          const audioRes = await fetch(ttsFileUrl)
          if (!audioRes.ok) {
            console.error(`[TTS] /api/chat: Failed to fetch audio: ${audioRes.status} ${audioRes.statusText}`)
            throw new Error(`TTS audio fetch failed: ${audioRes.status}`)
          }
          const buf = Buffer.from(await audioRes.arrayBuffer())
          console.log(`[TTS] /api/chat: Audio buffer ${buf.length} bytes`)
          const b64 = buf.toString('base64')
          const audioUrl = `data:audio/wav;base64,${b64}`
          console.log(`[TTS] /api/chat: Success`)
          controller.enqueue(encoder.encode(
            JSON.stringify({ type: 'audio', audioUrl }) + '\n'
          ))
        } catch (e) {
          console.error('[TTS] /api/chat: Server TTS failed:', e instanceof Error ? e.message : String(e))
          if (e instanceof Error && e.stack) console.error('[TTS] Stack:', e.stack)
          controller.enqueue(encoder.encode(
            JSON.stringify({ type: 'audio', audioUrl: null }) + '\n'
          ))
        }

        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (err) {
    return handleApiError(err, 'POST /api/chat')
  }
}
