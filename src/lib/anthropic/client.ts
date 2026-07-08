import Anthropic from '@anthropic-ai/sdk'

// Module-level singleton — reused across warm invocations in the same
// serverless container instead of re-instantiating on every request.
let _anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')
    _anthropic = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 })
  }
  return _anthropic
}

// Claude Fable 5 — Anthropic's most capable model. Notes that shape this call:
//  - Thinking is always on: omit the `thinking` param entirely (an explicit
//    `{type:'disabled'}` returns 400). Control depth via `output_config.effort`.
//  - Sampling params (temperature/top_p/top_k) are removed — sending any 400s.
//  - Safety classifiers may return `stop_reason: 'refusal'` (HTTP 200). We opt
//    into a server-side fallback to Opus 4.8 so a benign false positive is
//    transparently re-served on the same call; a full-chain refusal throws so
//    the caller can fall back further (e.g. to OpenAI).
//  - Requires 30-day data retention on the org (not available under ZDR).
const CHAT_MODEL = 'claude-fable-5'
const FALLBACK_MODEL = 'claude-opus-4-8'

// Effort controls thinking depth vs. latency. 'medium' is a responsive default
// for text chat; voice passes 'low' to stay snappy (Fable 5 at low effort still
// outperforms prior models). Raise to 'high' for more thorough answers.
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
const DEFAULT_EFFORT: Effort = 'medium'

interface ClaudeMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ClaudeOptions {
  messages: ClaudeMessage[]
  max_tokens?: number
  effort?: Effort
}

/**
 * Split a flat messages array into Anthropic's `system` prompt + `messages`.
 * System turns are concatenated into the top-level system prompt; user/assistant
 * turns become the conversation. The API combines consecutive same-role turns.
 */
function toAnthropicInput(messages: ClaudeMessage[]): {
  system: string
  messages: Anthropic.MessageParam[]
} {
  const systemParts: string[] = []
  const convo: Anthropic.MessageParam[] = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      if (msg.content) systemParts.push(msg.content)
    } else {
      convo.push({ role: msg.role, content: msg.content })
    }
  }

  return { system: systemParts.join('\n\n'), messages: convo }
}

/**
 * Run a chat completion on Claude Fable 5 via the Anthropic API.
 * @returns the assistant's reply text
 * @throws if the request is refused by the whole fallback chain or returns empty
 */
export async function runClaude(options: ClaudeOptions): Promise<string> {
  const { messages, max_tokens = 2048, effort = DEFAULT_EFFORT } = options
  const client = getAnthropic()
  const { system, messages: convo } = toAnthropicInput(messages)

  const response = await client.beta.messages.create({
    model: CHAT_MODEL,
    max_tokens,
    output_config: { effort },
    betas: ['server-side-fallback-2026-06-01'],
    fallbacks: [{ model: FALLBACK_MODEL }],
    ...(system ? { system } : {}),
    messages: convo,
  })

  // A refusal that survived the fallback chain — surface it so the caller can
  // fall back to another provider rather than returning an empty reply.
  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined the request (refusal)')
  }

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()

  if (!text) throw new Error('Claude returned an empty response')
  return text
}
