import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { withAuth } from '@/lib/api-utils'
import { getGmailForUser } from '@/lib/gmail/client'
import { parseGmailMessageSummary } from '@/lib/gmail/message-parser'
import { runGemini } from '@/lib/replicate/client'
import { chatLimiter, getRateLimitKey } from '@/lib/rate-limit'
import {
  buildEmailSummariesForAI,
  buildSpamDetectionPrompt,
  parseAIJsonResponse,
  SPAM_BATCH_SIZE,
  type SpamClassification,
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

const SPAM_REVIEW_LABEL_NAME = 'Spam Review'
const SPAM_LABEL_COLOR = { textColor: '#ffffff', backgroundColor: '#cc3a21' }

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

  const body = await req.json().catch(() => ({}))
  const providedIds: string[] | undefined = body.messageIds

  // Fetch messages — either provided IDs or recent inbox
  let messageIds: string[]
  if (providedIds && providedIds.length > 0) {
    messageIds = providedIds.slice(0, SPAM_BATCH_SIZE)
  } else {
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: SPAM_BATCH_SIZE,
      q: 'in:inbox',
    })
    messageIds = (listResponse.data.messages ?? [])
      .map((m) => m.id!)
      .filter(Boolean)
  }

  if (messageIds.length === 0) {
    return NextResponse.json({
      results: [],
      spamCount: 0,
      movedCount: 0,
      totalChecked: 0,
      labelId: null,
    })
  }

  // Fetch metadata for each message
  const messageSummaries = await Promise.all(
    messageIds.map(async (id) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      })
      return parseGmailMessageSummary(msg.data)
    }),
  )

  const emailSummaries = buildEmailSummariesForAI(messageSummaries)

  // Call LLM for spam classification
  const systemPrompt = buildSpamDetectionPrompt()
  const userPrompt = `Analyze these ${emailSummaries.length} emails:\n\n${JSON.stringify(emailSummaries, null, 2)}`

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
    console.error('Gemini spam detection error:', err instanceof Error ? err.message : String(err))
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
      console.error('OpenAI spam fallback error:', fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr))
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
    }
  }

  let results: SpamClassification[]
  try {
    results = parseAIJsonResponse<SpamClassification[]>(rawResponse)
  } catch {
    console.error('Failed to parse spam classification response:', rawResponse.slice(0, 500))
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  // Filter high-confidence spam
  const spamMessages = results.filter((r) => r.isSpam && r.confidence >= 0.7)

  let labelId: string | null = null
  let movedCount = 0

  if (spamMessages.length > 0) {
    // Find or create "Spam Review" label
    const labelsRes = await gmail.users.labels.list({ userId: 'me' })
    const existingLabel = (labelsRes.data.labels ?? []).find(
      (l) => l.name === SPAM_REVIEW_LABEL_NAME,
    )

    if (existingLabel?.id) {
      labelId = existingLabel.id
    } else {
      const created = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: SPAM_REVIEW_LABEL_NAME,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
          color: SPAM_LABEL_COLOR,
        },
      })
      labelId = created.data.id ?? null
    }

    if (labelId) {
      // Move spam messages: add Spam Review label, remove INBOX
      await Promise.all(
        spamMessages.map(async (spam) => {
          try {
            await gmail.users.messages.modify({
              userId: 'me',
              id: spam.messageId,
              requestBody: {
                addLabelIds: [labelId!],
                removeLabelIds: ['INBOX'],
              },
            })
            movedCount++
          } catch (err) {
            console.error(`Failed to move message ${spam.messageId}:`, err)
          }
        }),
      )
    }
  }

  return NextResponse.json({
    results,
    spamCount: spamMessages.length,
    movedCount,
    totalChecked: results.length,
    labelId,
  })
}, 'POST /api/email/ai/spam')
