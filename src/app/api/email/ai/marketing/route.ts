import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { withAuth } from '@/lib/api-utils'
import { getGmailForUser } from '@/lib/gmail/client'
import {
  getHeader,
  extractSenderEmail,
  extractSenderName,
  parseListUnsubscribe,
} from '@/lib/gmail/message-parser'
import { runGemini } from '@/lib/replicate/client'
import { chatLimiter, getRateLimitKey } from '@/lib/rate-limit'
import {
  buildEmailSummariesForAI,
  buildMarketingDetectionPrompt,
  parseAIJsonResponse,
  MARKETING_BATCH_SIZE,
} from '@/lib/gmail/email-ai-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
    _openai = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 })
  }
  return _openai
}

const MARKETING_LABEL_NAME = 'Marketing'
const MARKETING_LABEL_COLOR = { textColor: '#ffffff', backgroundColor: '#a46a21' }
const MIN_CONFIDENCE = 0.7

interface AIMarketingResult {
  messageId: string
  isMarketing: boolean
  confidence: number
  reason: string
}

export interface MarketingSenderGroup {
  senderEmail: string
  senderName: string
  emailCount: number
  unsubscribeUrl: string | null
  unsubscribeMailto: string | null
  hasOneClick: boolean
  messageIds: string[]
}

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

  // Fetch inbox messages with unsubscribe headers
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    maxResults: MARKETING_BATCH_SIZE,
    q: 'in:inbox',
  })
  const messageIds = (listResponse.data.messages ?? [])
    .map((m) => m.id!)
    .filter(Boolean)

  if (messageIds.length === 0) {
    return NextResponse.json({ results: [], movedCount: 0, senders: [] })
  }

  // Fetch metadata including List-Unsubscribe headers
  const messageMeta = await Promise.all(
    messageIds.map(async (id) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date', 'List-Unsubscribe', 'List-Unsubscribe-Post'],
      })
      const headers = msg.data.payload?.headers
      return {
        id: msg.data.id ?? '',
        from: getHeader(headers, 'From'),
        subject: getHeader(headers, 'Subject'),
        snippet: msg.data.snippet ?? '',
        date: getHeader(headers, 'Date'),
        listUnsubscribe: getHeader(headers, 'List-Unsubscribe'),
        listUnsubscribePost: getHeader(headers, 'List-Unsubscribe-Post'),
      }
    }),
  )

  // Build AI summaries and classify
  const emailSummaries = buildEmailSummariesForAI(messageMeta)
  const systemPrompt = buildMarketingDetectionPrompt()
  const userPrompt = `Classify these ${emailSummaries.length} emails as marketing or not:\n\n${JSON.stringify(emailSummaries, null, 2)}`

  let rawResponse: string
  try {
    rawResponse = await runGemini({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    })
  } catch (err) {
    console.error('Gemini marketing error:', err instanceof Error ? err.message : String(err))
    try {
      const openai = getOpenAI()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      })
      rawResponse = completion.choices[0]?.message?.content ?? '[]'
    } catch (fallbackErr) {
      console.error('OpenAI marketing fallback error:', fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr))
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
    }
  }

  let aiResults: AIMarketingResult[]
  try {
    aiResults = parseAIJsonResponse<AIMarketingResult[]>(rawResponse)
  } catch {
    console.error('Failed to parse marketing response:', rawResponse.slice(0, 500))
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  // Find or create "Marketing" label
  const labelsRes = await gmail.users.labels.list({ userId: 'me' })
  const existingLabels = labelsRes.data.labels ?? []
  let marketingLabelId = existingLabels.find((l) => l.name === MARKETING_LABEL_NAME)?.id

  if (!marketingLabelId) {
    try {
      const created = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: MARKETING_LABEL_NAME,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
          color: MARKETING_LABEL_COLOR,
        },
      })
      marketingLabelId = created.data.id ?? undefined
    } catch (err: any) {
      if (err?.code === 409 || err?.status === 409) {
        const refreshed = await gmail.users.labels.list({ userId: 'me' })
        marketingLabelId = (refreshed.data.labels ?? []).find((l) => l.name === MARKETING_LABEL_NAME)?.id
      } else {
        console.error('Failed to create Marketing label:', err)
        return NextResponse.json({ error: 'Failed to create Marketing label' }, { status: 500 })
      }
    }
  }

  if (!marketingLabelId) {
    return NextResponse.json({ error: 'Could not resolve Marketing label' }, { status: 500 })
  }

  // Build a lookup for message metadata (for unsubscribe headers)
  const metaMap = new Map(messageMeta.map((m) => [m.id, m]))

  // Apply labels and move out of inbox for confident marketing classifications
  const marketingResults: AIMarketingResult[] = []
  let movedCount = 0

  await Promise.all(
    aiResults.map(async (result) => {
      if (!result.isMarketing || result.confidence < MIN_CONFIDENCE) return

      marketingResults.push(result)

      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id: result.messageId,
          requestBody: {
            addLabelIds: [marketingLabelId!],
            removeLabelIds: ['INBOX'],
          },
        })
        movedCount++
      } catch (err) {
        console.error(`Failed to move message ${result.messageId}:`, err)
      }
    }),
  )

  // Group by sender with unsubscribe data
  const senderMap = new Map<string, MarketingSenderGroup>()

  for (const result of marketingResults) {
    const meta = metaMap.get(result.messageId)
    if (!meta) continue

    const email = extractSenderEmail(meta.from)
    const existing = senderMap.get(email)

    const unsub = parseListUnsubscribe(meta.listUnsubscribe)
    const hasOneClick = !!meta.listUnsubscribePost && !!unsub.httpUrl

    if (existing) {
      existing.emailCount++
      existing.messageIds.push(result.messageId)
      // Keep the first unsubscribe info found
      if (!existing.unsubscribeUrl && unsub.httpUrl) existing.unsubscribeUrl = unsub.httpUrl
      if (!existing.unsubscribeMailto && unsub.mailto) existing.unsubscribeMailto = unsub.mailto
      if (!existing.hasOneClick && hasOneClick) existing.hasOneClick = hasOneClick
    } else {
      senderMap.set(email, {
        senderEmail: email,
        senderName: extractSenderName(meta.from),
        emailCount: 1,
        unsubscribeUrl: unsub.httpUrl,
        unsubscribeMailto: unsub.mailto,
        hasOneClick,
        messageIds: [result.messageId],
      })
    }
  }

  const senders = Array.from(senderMap.values()).sort((a, b) => b.emailCount - a.emailCount)

  return NextResponse.json({
    results: aiResults,
    movedCount,
    senders,
  })
}, 'POST /api/email/ai/marketing')
