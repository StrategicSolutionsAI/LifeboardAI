import { NextRequest, NextResponse } from 'next/server'
import { runWhisper, runTTS, runClaudeStream } from '@/lib/replicate/client'
import { getRequestOrigin, withAuth } from '@/lib/api-utils'
import { getCommandsPrompt, processReplyCommands, displayableStreamPrefix, finalizeStreamedText } from '@/lib/chat-commands'
import { buildChatContext } from '@/lib/chat-context'
import { chatLimiter, getRateLimitKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/** Reject uploads larger than this — a voice turn is seconds of webm/opus,
 * so 15MB is already generous. Prevents unbounded Whisper cost + memory. */
const MAX_AUDIO_BYTES = 15 * 1024 * 1024
/** Max characters per history message forwarded to the LLM */
const MAX_MESSAGE_CHARS = 4000

/** Spoken replies get long (and expensive — every ~40s of synthesized audio
 * is another paid chatterbox prediction) unless the model is told this is a
 * voice conversation. */
const VOICE_BREVITY_INSTRUCTION =
  'Voice conversation: your reply will be read aloud. Keep replies under about 60 words unless the user explicitly asks you to elaborate. Prefer one or two short sentences. Never use markdown, bullet lists, or headings — speak naturally.'

export const POST = withAuth(async (req: NextRequest, { supabase, user }) => {
  const t0 = Date.now()
  try {
    // Rate limit before any expensive work (Whisper + AI calls cost money)
    const rateLimited = chatLimiter.check(getRateLimitKey(req, user.id))
    if (rateLimited) return rateLimited

    // Expect multipart/form-data with a field named 'audio'
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    if (!audioFile) {
      return NextResponse.json({ error: 'Missing audio file' }, { status: 400 })
    }
    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio file too large (max 15MB)' }, { status: 413 })
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
          // Keep last 10 messages to stay within token limits; validate + cap
          // each turn server-side (never trust client-supplied history)
          conversationHistory = parsed
            .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .slice(-10)
            .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
        }
      } catch {}
    }

    // Dashboard context does not depend on the transcription, so load it
    // alongside Whisper instead of adding its latency to every voice turn.
    const tCtx = Date.now()
    const contextPromise = buildChatContext(req)
      .then((context) => ({ context, ctxMs: Date.now() - tCtx }))
      .catch((error) => {
        console.error('Failed to build voice chat context:', error instanceof Error ? error.message : String(error))
        return { context: { systemContext: '', userId: null }, ctxMs: Date.now() - tCtx }
      })

    // Transcribe audio to text via Whisper on Replicate
    const tStt = Date.now()
    const buf = Buffer.from(await audioFile.arrayBuffer())
    const transcript = await runWhisper({ audio: buf, mimeType: audioFile.type || undefined })
    const sttMs = Date.now() - tStt
    if (!transcript) {
      return NextResponse.json({ error: 'Empty transcription' }, { status: 422 })
    }
    const { context: { systemContext }, ctxMs } = await contextPromise

    const origin = getRequestOrigin(req)

    // Build system prompt with all available commands
    const todayIso = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)
    const currentYear = todayIso.slice(0,4)
    const lifeboardInstruction = getCommandsPrompt(todayIso, currentYear)

    // Ask the assistant using transcript as the user message, with conversation history
    const chatMessages = [
      { role: 'system' as const, content: lifeboardInstruction },
      { role: 'system' as const, content: VOICE_BREVITY_INSTRUCTION },
      ...(systemContext ? [{ role: 'system' as const, content: systemContext }] : []),
      ...conversationHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: transcript }
    ]

    // Stream response: transcript first, then reply tokens, then the
    // authoritative text frame, then audio.
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

        // Chunk 1: transcript (so client can show what the user said)
        enqueue({ type: 'transcript', text: transcript })

        // Stream LLM tokens as they arrive. Command blocks are held back from
        // display (displayableStreamPrefix) so a [LIFEBOARD_CMD] sentinel never
        // flashes; actions run from the full text afterward, staying atomic.
        let raw = ''
        let emittedLen = 0
        let streamErrored = false
        const tLlm = Date.now()
        try {
          for await (const piece of runClaudeStream({ messages: chatMessages, max_tokens: 2048 })) {
            raw += piece
            const safe = displayableStreamPrefix(raw)
            if (safe.length > emittedLen) {
              enqueue({ type: 'delta', text: safe.slice(emittedLen) })
              emittedLen = safe.length
            }
          }
        } catch (claudeErr) {
          // Both models failed, or a mid-stream error after partial tokens
          streamErrored = true
          console.error('Claude (Replicate) stream error (voice):', claudeErr instanceof Error ? claudeErr.message : String(claudeErr))
        }
        const llmMs = Date.now() - tLlm

        let llmFailed = false
        let reply = streamErrored ? finalizeStreamedText(raw) : raw
        if (!reply.trim()) {
          llmFailed = true
          reply = "I'm currently experiencing technical difficulties. The AI service is taking longer than expected to respond. Please try again in a moment."
        }

        // Execute all commands on the FULL text (create/complete tasks, etc.).
        // Skipped on LLM failure: the canned fallback never contains commands.
        let createdTask: any | undefined
        let commandsExecuted = false
        const tCmd = Date.now()
        if (!llmFailed) {
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
        const cmdMs = Date.now() - tCmd

        // Authoritative text frame: canonical cleaned/trimmed reply plus command
        // side-effect metadata. Replaces whatever streamed via deltas. isError
        // lets the client style the fallback as an error.
        enqueue({ type: 'text', reply, createdTask, commandsExecuted, ...(llmFailed && { isError: true }) })

        // Chunk 3: TTS audio (generated in background, streamed when ready) —
        // skipped entirely when the speak-replies toggle is off (saves a paid
        // prediction), and on LLM failure: never spend a paid prediction
        // reading an error message aloud.
        let ttsMs = 0
        if (!speakReplies || llmFailed) {
          enqueue({ type: 'audio', audioUrl: null, skipped: true })
        } else {
          const tTts = Date.now()
          try {
            const ttsVoice = requestedVoice || process.env.TTS_VOICE || 'Chloe'
            console.log(`[TTS] Starting synthesis: voice=${ttsVoice}, text length=${reply.length}`)
            const audioBuf = await runTTS({ text: reply, voice: ttsVoice })
            console.log(`[TTS] Audio buffer size: ${audioBuf.length} bytes`)
            const b64 = audioBuf.toString('base64')
            const audioUrl = `data:audio/wav;base64,${b64}`
            console.log(`[TTS] Success — data URI length: ${audioUrl.length}`)
            enqueue({ type: 'audio', audioUrl })
          } catch (e) {
            console.error('[TTS] Server TTS failed:', e instanceof Error ? e.message : String(e))
            if (e instanceof Error && e.stack) console.error('[TTS] Stack:', e.stack)
            // Send empty audio chunk so client knows TTS is done (failed)
            enqueue({ type: 'audio', audioUrl: null })
          }
          ttsMs = Date.now() - tTts
        }

        // One structured timing line per request — grep '[chat-timing]' to
        // spot latency regressions per pipeline stage.
        console.log('[chat-timing]', JSON.stringify({
          route: 'voice', sttMs, ctxMs, llmMs, cmdMs, ttsMs,
          totalMs: Date.now() - t0, audioBytes: audioFile.size,
          replyChars: reply.length, llmFailed,
        }))
        controller.close()
      },
    })

    return new NextResponse(stream, {
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
}, 'POST /api/chat/voice')
