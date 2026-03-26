import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { withAuth } from '@/lib/api-utils'
import { getGmailForUser } from '@/lib/gmail/client'
import { parseGmailMessage } from '@/lib/gmail/message-parser'
import { runGemini } from '@/lib/replicate/client'
import { chatLimiter, getRateLimitKey } from '@/lib/rate-limit'
import {
  buildTaskExtractionPrompt,
  parseAIJsonResponse,
  type TaskExtraction,
} from '@/lib/gmail/email-ai-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
    _openai = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 })
  }
  return _openai
}

const BATCH_SIZE = 15 // Max emails to scan per request

export const POST = withAuth(async (req: NextRequest, { supabase, user }) => {
  const rateLimitKey = getRateLimitKey(req)
  const rateLimited = chatLimiter.check(rateLimitKey)
  if (rateLimited) return rateLimited

  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account') ?? undefined

  const gmail = await getGmailForUser(supabase, user.id, account)
  if (!gmail) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 404 })
  }

  const body = await req.json()
  const { messageIds, buckets = [] } = body as { messageIds: string[]; buckets?: string[] }
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return NextResponse.json({ error: 'messageIds array is required' }, { status: 400 })
  }

  // Limit batch size
  const idsToScan = messageIds.slice(0, BATCH_SIZE)

  // Fetch email contents in parallel
  const emailSummaries: string[] = []
  const fetchResults = await Promise.allSettled(
    idsToScan.map(async (id) => {
      const msgResponse = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      })
      return parseGmailMessage(msgResponse.data, true)
    })
  )

  for (const result of fetchResults) {
    if (result.status === 'fulfilled') {
      const parsed = result.value
      const content = (parsed.textBody || parsed.snippet || '').slice(0, 1500)
      emailSummaries.push(
        `--- Email ---\nFrom: ${parsed.from}\nSubject: ${parsed.subject}\nDate: ${parsed.date}\n\n${content}\n--- End Email ---`
      )
    }
  }

  if (emailSummaries.length === 0) {
    return NextResponse.json({ tasks: [] })
  }

  const currentDate = new Date().toISOString().split('T')[0]
  const systemPrompt = buildTaskExtractionPrompt(currentDate, buckets)
  const emailBatch = emailSummaries.join('\n\n')

  let rawResponse: string
  try {
    rawResponse = await runGemini({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze these ${emailSummaries.length} emails for actionable tasks:\n\n${emailBatch}` },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    })
  } catch (err) {
    console.error('Gemini task extraction error:', err instanceof Error ? err.message : String(err))
    try {
      const openai = getOpenAI()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze these ${emailSummaries.length} emails for actionable tasks:\n\n${emailBatch}` },
        ],
        max_tokens: 2048,
        temperature: 0.3,
      })
      rawResponse = completion.choices[0]?.message?.content ?? '[]'
    } catch (fallbackErr) {
      console.error('OpenAI task extraction fallback error:', fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr))
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
    }
  }

  let tasks: TaskExtraction[]
  try {
    tasks = parseAIJsonResponse<TaskExtraction[]>(rawResponse)
    // Filter to actionable confidence
    tasks = tasks.filter((t) => t.confidence >= 0.4)
  } catch (parseErr) {
    console.error('Failed to parse task extraction response:', parseErr)
    tasks = []
  }

  return NextResponse.json({ tasks, totalScanned: emailSummaries.length })
}, 'POST /api/email/ai/extract-tasks')
