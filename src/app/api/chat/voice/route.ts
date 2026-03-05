import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { runGeminiFlash, runWhisper, runTTS } from '@/lib/replicate/client'
import { supabaseServer } from '@/utils/supabase/server'
import { getCommandsPrompt, processReplyCommands } from '@/lib/chat-commands'
import { buildChatContext } from '@/lib/chat-context'
import { chatLimiter, getRateLimitKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

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
    const requestedSpeedRaw = (formData.get('speed') as string | null)
    const requestedSpeed = requestedSpeedRaw ? Number(requestedSpeedRaw) : undefined

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
    const geminiMessages = [
      ...(systemContext ? [{ role: 'system' as const, content: systemContext }] : []),
      ...conversationHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: transcript }
    ]

    let reply: string
    try {
      // Use Gemini 2.5 Flash for voice — ~3.5x faster than Pro
      reply = await runGeminiFlash({
        messages: [
          { role: 'system', content: lifeboardInstruction },
          ...geminiMessages,
        ],
        max_tokens: 2048,
        temperature: 0.7,
      })
    } catch (geminiErr) {
      console.error('Gemini Flash error (voice):', geminiErr instanceof Error ? geminiErr.message : String(geminiErr))
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

        // Chunk 3: TTS audio (generated in background, streamed when ready)
        try {
          const ttsVoice = requestedVoice || process.env.TTS_VOICE || 'Chloe'
          console.log(`[TTS] Starting synthesis: voice=${ttsVoice}, text length=${reply.length}`)
          const ttsFileUrl = await runTTS({
            text: reply,
            voice: ttsVoice,
            speed: typeof requestedSpeed === 'number' && !Number.isNaN(requestedSpeed) ? requestedSpeed : undefined,
          })
          console.log(`[TTS] Got file URL: ${ttsFileUrl.slice(0, 80)}...`)
          const audioRes = await fetch(ttsFileUrl)
          if (!audioRes.ok) {
            console.error(`[TTS] Failed to fetch audio: ${audioRes.status} ${audioRes.statusText}`)
            throw new Error(`TTS audio fetch failed: ${audioRes.status}`)
          }
          const audioBuf = Buffer.from(await audioRes.arrayBuffer())
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

    // Map common quota/auth errors to a structured reply the client can detect
    const status = /quota/i.test(errMsg) ? 402 : 500
    const body = /quota/i.test(errMsg)
      ? { reply: 'OpenAI quota exceeded. Please add credits or switch to browser speech.' }
      : { error: process.env.NODE_ENV === 'development' ? errMsg : 'Internal error' }

    return NextResponse.json(body, { status })
  }
}
