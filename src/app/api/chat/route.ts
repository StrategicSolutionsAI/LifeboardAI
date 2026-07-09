import { NextRequest, NextResponse } from 'next/server'
import { runTTS, runClaudeStream } from '@/lib/replicate/client'
import { withAuth } from '@/lib/api-utils'
import { getCommandsPrompt, processReplyCommands, displayableStreamPrefix, finalizeStreamedText } from '@/lib/chat-commands'
import { buildChatContext } from '@/lib/chat-context'
import { chatLimiter, getRateLimitKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/** Max conversation turns forwarded to the LLM — the client may store more,
 * but history size must be capped server-side (tokens cost money). */
const MAX_HISTORY_MESSAGES = 20
/** Max characters per message forwarded to the LLM */
const MAX_MESSAGE_CHARS = 8000

export const POST = withAuth(async (req: NextRequest, { supabase, user }) => {
  const t0 = Date.now()

  // Rate limit before any expensive work (AI calls cost money)
  const rateLimited = chatLimiter.check(getRateLimitKey(req, user.id))
  if (rateLimited) return rateLimited

  const body = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    /** Present only when the client wants spoken replies (speak-replies toggle on) */
    tts?: { voice?: string }
  }

  // Validate + cap input server-side — never trust client-supplied history size
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY_MESSAGES)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))

  // Ensure at least one user message
  if (messages.length === 0) {
    return NextResponse.json({ error: 'No messages' }, { status: 400 })
  }

  // Fetch comprehensive user context via shared builder (uses Promise.allSettled)
  const tCtx = Date.now()
  const { systemContext } = await buildChatContext(req)
  const ctxMs = Date.now() - tCtx
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

  // Stream response: emit reply tokens as they arrive (type:'delta'), then an
  // authoritative type:'text' frame once the full reply is known, then TTS.
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      // --- Stream LLM tokens. Command blocks are held back from display
      // (displayableStreamPrefix) so a [LIFEBOARD_CMD] sentinel never flashes;
      // actions are executed from the full text afterward, staying atomic. ---
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
      } catch (error) {
        // Both models failed, or a mid-stream error after partial tokens
        streamErrored = true
        console.error('Claude (Replicate) stream error:', error instanceof Error ? error.message : String(error))
      }
      const llmMs = Date.now() - tLlm

      let llmFailed = false
      let reply = streamErrored ? finalizeStreamedText(raw) : raw
      if (!reply.trim()) {
        llmFailed = true
        reply = "I'm currently experiencing technical difficulties. The AI service is taking longer than expected to respond. Please try again in a moment."
      }

      // Execute all commands in the reply (create tasks, complete tasks, etc.)
      // on the FULL text. Skipped on LLM failure: the fallback has no commands.
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

      // Authoritative text frame: the canonical cleaned/trimmed reply plus
      // command side-effect metadata. Replaces whatever streamed via deltas.
      // isError lets the client style the fallback as an error.
      enqueue({ type: 'text', reply, createdTask, commandsExecuted, ...(llmFailed && { isError: true }) })

      // TTS audio (generated in background) — only when the client
      // requested speech. Skipping this saves a chatterbox-turbo prediction
      // (real money) for every typed message with speak-replies off.
      // Also skipped on LLM failure: never spend a paid prediction reading
      // an error message aloud.
      let ttsMs = 0
      if (!body.tts || llmFailed) {
        enqueue({ type: 'audio', audioUrl: null, skipped: true })
      } else {
        const tTts = Date.now()
        try {
          const ttsVoice = body.tts.voice || process.env.TTS_VOICE || 'Chloe'
          console.log(`[TTS] /api/chat: Starting synthesis: voice=${ttsVoice}, text length=${reply.length}`)
          const buf = await runTTS({ text: reply, voice: ttsVoice })
          console.log(`[TTS] /api/chat: Audio buffer ${buf.length} bytes`)
          const b64 = buf.toString('base64')
          const audioUrl = `data:audio/wav;base64,${b64}`
          console.log(`[TTS] /api/chat: Success`)
          enqueue({ type: 'audio', audioUrl })
        } catch (e) {
          console.error('[TTS] /api/chat: Server TTS failed:', e instanceof Error ? e.message : String(e))
          if (e instanceof Error && e.stack) console.error('[TTS] Stack:', e.stack)
          enqueue({
            type: 'audio',
            audioUrl: null,
            ...(process.env.NODE_ENV !== 'production' && {
              error: e instanceof Error ? e.message : String(e),
            }),
          })
        }
        ttsMs = Date.now() - tTts
      }

      // One structured timing line per request — grep '[chat-timing]' to
      // spot latency regressions per pipeline stage.
      console.log('[chat-timing]', JSON.stringify({
        route: 'chat', ctxMs, llmMs, cmdMs, ttsMs,
        totalMs: Date.now() - t0, replyChars: reply.length, llmFailed,
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
}, 'POST /api/chat')
