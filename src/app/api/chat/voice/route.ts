import { NextRequest, NextResponse } from 'next/server'
import { runWhisper, runTTS, runClaude } from '@/lib/replicate/client'
import { supabaseServer } from '@/utils/supabase/server'
import { getCommandsPrompt, processReplyCommands } from '@/lib/chat-commands'
import { buildChatContext } from '@/lib/chat-context'
import { chatLimiter, getRateLimitKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    // Rate limit before any expensive work (Whisper + AI calls cost money)
    const rateLimitKey = getRateLimitKey(req)
    const rateLimited = chatLimiter.check(rateLimitKey)
    if (rateLimited) return rateLimited

    // Expect multipart/form-data with a field named 'audio'
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    if (!audioFile) {
      return NextResponse.json({ error: 'Missing audio file' }, { status: 400 })
    }

    const requestedVoice = (formData.get('voice') as string | null) || undefined
    // 'speak' gates server-side TTS (each synthesis is a paid chatterbox-turbo
    // prediction). Defaults to on when absent for backward compatibility.
    const speakReplies = (formData.get('speak') as string | null) !== '0'

    // Parse conversation history for multi-turn context
    let conversationHistory: { role: string; content: string }[] = []
    const historyRaw = formData.get('history') as string | null
    if (historyRaw) {
      try {
        const parsed = JSON.parse(historyRaw)
        if (Array.isArray(parsed)) {
          // Keep last 10 messages to stay within token limits
          conversationHistory = parsed.slice(-10)
        }
      } catch {}
    }

    // Transcribe audio to text via Whisper on Replicate
    const buf = Buffer.from(await audioFile.arrayBuffer())
    const transcript = await runWhisper({ audio: buf, mimeType: audioFile.type || undefined })
    if (!transcript) {
      return NextResponse.json({ error: 'Empty transcription' }, { status: 422 })
    }

    // Fetch comprehensive user context via shared builder (uses Promise.allSettled)
    const { systemContext, userId } = await buildChatContext(req)
    const supabase = supabaseServer()
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`

    // Build system prompt with all available commands
    const todayIso = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)
    const currentYear = todayIso.slice(0,4)
    const lifeboardInstruction = getCommandsPrompt(todayIso, currentYear)

    // Ask the assistant using transcript as the user message, with conversation history
    const chatMessages = [
      { role: 'system' as const, content: lifeboardInstruction },
      ...(systemContext ? [{ role: 'system' as const, content: systemContext }] : []),
      ...conversationHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: transcript }
    ]

    let reply: string
    try {
      // Claude Fable 5 on Replicate (retries on Claude 4.5 Sonnet internally)
      reply = await runClaude({
        messages: chatMessages,
        max_tokens: 2048,
      })
    } catch (claudeErr) {
      // runClaude already retried on Claude 4.5 Sonnet — this is a full-chain failure
      console.error('Claude (Replicate) error (voice):', claudeErr instanceof Error ? claudeErr.message : String(claudeErr))
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

    // Stream response: transcript first, then text, then audio
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        // Chunk 1: transcript (so client can show what the user said)
        controller.enqueue(encoder.encode(
          JSON.stringify({ type: 'transcript', text: transcript }) + '\n'
        ))

        // Chunk 2: text reply (sent immediately so client can display it)
        controller.enqueue(encoder.encode(
          JSON.stringify({ type: 'text', reply, createdTask, commandsExecuted }) + '\n'
        ))

        // Chunk 3: TTS audio (generated in background, streamed when ready) —
        // skipped entirely when the speak-replies toggle is off (saves a paid prediction)
        if (!speakReplies) {
          controller.enqueue(encoder.encode(
            JSON.stringify({ type: 'audio', audioUrl: null, skipped: true }) + '\n'
          ))
          controller.close()
          return
        }
        try {
          const ttsVoice = requestedVoice || process.env.TTS_VOICE || 'Chloe'
          console.log(`[TTS] Starting synthesis: voice=${ttsVoice}, text length=${reply.length}`)
          const audioBuf = await runTTS({ text: reply, voice: ttsVoice })
          console.log(`[TTS] Audio buffer size: ${audioBuf.length} bytes`)
          const b64 = audioBuf.toString('base64')
          const audioUrl = `data:audio/wav;base64,${b64}`
          console.log(`[TTS] Success — data URI length: ${audioUrl.length}`)
          controller.enqueue(encoder.encode(
            JSON.stringify({ type: 'audio', audioUrl }) + '\n'
          ))
        } catch (e) {
          console.error('[TTS] Server TTS failed:', e instanceof Error ? e.message : String(e))
          if (e instanceof Error && e.stack) console.error('[TTS] Stack:', e.stack)
          // Send empty audio chunk so client knows TTS is done (failed)
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
    const errMsg = err instanceof Error ? err.message : String(err)
    const errStack = err instanceof Error ? err.stack : undefined
    console.error('Voice chat route error:', errMsg)
    if (errStack) console.error(errStack)

    // Map common quota/credit errors to a structured reply the client can detect
    const isQuota = /quota|credit/i.test(errMsg)
    const status = isQuota ? 402 : 500
    const body = isQuota
      ? { reply: 'AI credits exhausted. Please add Replicate credits or switch to browser speech.' }
      : { error: process.env.NODE_ENV === 'development' ? errMsg : 'Internal error' }

    return NextResponse.json(body, { status })
  }
}
