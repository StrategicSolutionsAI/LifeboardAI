import { NextRequest, NextResponse } from 'next/server'
import { runTTS, runClaude } from '@/lib/replicate/client'
import { supabaseServer } from '@/utils/supabase/server'
import { handleApiError } from '@/lib/api-error-handler'
import { getCommandsPrompt, processReplyCommands } from '@/lib/chat-commands'
import { buildChatContext } from '@/lib/chat-context'
import { chatLimiter, getRateLimitKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    // Rate limit before any expensive work (AI calls cost money)
    const rateLimitKey = getRateLimitKey(req)
    const rateLimited = chatLimiter.check(rateLimitKey)
    if (rateLimited) return rateLimited

    const body = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      /** Present only when the client wants spoken replies (speak-replies toggle on) */
      tts?: { voice?: string }
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

    // Primary model: Claude Fable 5 on Replicate (retries on Claude 4.5 Sonnet internally)
    const chatMessages = [
      { role: 'system' as const, content: lifeboardInstruction },
      ...(systemContext ? [{ role: 'system' as const, content: systemContext }] : []),
      ...messages.map(({ role, content }) => ({ role: role as 'user' | 'assistant', content }))
    ]

    let reply: string | undefined
    try {
      reply = await runClaude({
        messages: chatMessages,
        max_tokens: 2048,
      })
    } catch (error) {
      // runClaude already retried on Claude 4.5 Sonnet — this is a full-chain failure
      console.error('Claude (Replicate) error:', error instanceof Error ? error.message : String(error))
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

        // Chunk 2: TTS audio (generated in background) — only when the client
        // requested speech. Skipping this saves a chatterbox-turbo prediction
        // (real money) for every typed message with speak-replies off.
        if (!body.tts) {
          controller.enqueue(encoder.encode(
            JSON.stringify({ type: 'audio', audioUrl: null, skipped: true }) + '\n'
          ))
          controller.close()
          return
        }
        try {
          const ttsVoice = body.tts.voice || process.env.TTS_VOICE || 'Chloe'
          console.log(`[TTS] /api/chat: Starting synthesis: voice=${ttsVoice}, text length=${reply.length}`)
          const buf = await runTTS({ text: reply, voice: ttsVoice })
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
            JSON.stringify({
              type: 'audio',
              audioUrl: null,
              ...(process.env.NODE_ENV !== 'production' && {
                error: e instanceof Error ? e.message : String(e),
              }),
            }) + '\n'
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
