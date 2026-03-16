import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { withAuth } from '@/lib/api-utils'
import { getGmailForUser } from '@/lib/gmail/client'
import { parseGmailMessageSummary } from '@/lib/gmail/message-parser'
import { runGemini } from '@/lib/replicate/client'
import { chatLimiter, getRateLimitKey } from '@/lib/rate-limit'
import {
  buildEmailSummariesForAI,
  buildOrganizationPrompt,
  parseAIJsonResponse,
  ORGANIZE_BATCH_SIZE,
  CATEGORY_LABEL_COLORS,
  type EmailCategory,
  type EmailCategoryName,
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

const AI_LABEL_PREFIX = 'AI/'

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

  // Fetch messages
  let messageIds: string[]
  if (providedIds && providedIds.length > 0) {
    messageIds = providedIds.slice(0, ORGANIZE_BATCH_SIZE)
  } else {
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: ORGANIZE_BATCH_SIZE,
      q: 'in:inbox',
    })
    messageIds = (listResponse.data.messages ?? [])
      .map((m) => m.id!)
      .filter(Boolean)
  }

  if (messageIds.length === 0) {
    return NextResponse.json({
      results: [],
      totalOrganized: 0,
      categorySummary: {},
    })
  }

  // Fetch metadata
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

  // Call LLM for categorization
  const systemPrompt = buildOrganizationPrompt()
  const userPrompt = `Categorize these ${emailSummaries.length} emails:\n\n${JSON.stringify(emailSummaries, null, 2)}`

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
    console.error('Gemini organize error:', err instanceof Error ? err.message : String(err))
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
      console.error('OpenAI organize fallback error:', fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr))
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
    }
  }

  let results: EmailCategory[]
  try {
    results = parseAIJsonResponse<EmailCategory[]>(rawResponse)
  } catch {
    console.error('Failed to parse organization response:', rawResponse.slice(0, 500))
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  // Pre-fetch existing labels to avoid duplicate creation
  const labelsRes = await gmail.users.labels.list({ userId: 'me' })
  const existingLabels = labelsRes.data.labels ?? []
  const labelMap = new Map<string, string>() // category name -> label ID
  for (const label of existingLabels) {
    if (label.name && label.id) {
      labelMap.set(label.name, label.id)
    }
  }

  // Valid categories
  const validCategories = new Set<EmailCategoryName>([
    'Important', 'Work', 'Personal', 'Newsletter',
    'Receipt', 'Social', 'Notification', 'Promotional',
  ])

  // Apply labels — non-destructive (only adds, does NOT remove from INBOX)
  const categorySummary: Record<string, number> = {}
  let totalOrganized = 0

  await Promise.all(
    results.map(async (result) => {
      if (!validCategories.has(result.category)) return

      const labelName = `${AI_LABEL_PREFIX}${result.category}`

      // Find or create the label
      let labelId = labelMap.get(labelName)
      if (!labelId) {
        try {
          const colors = CATEGORY_LABEL_COLORS[result.category]
          const created = await gmail.users.labels.create({
            userId: 'me',
            requestBody: {
              name: labelName,
              labelListVisibility: 'labelShow',
              messageListVisibility: 'show',
              ...(colors ? { color: colors } : {}),
            },
          })
          labelId = created.data.id ?? undefined
          if (labelId) {
            labelMap.set(labelName, labelId)
          }
        } catch (err: any) {
          // Label might already exist (race condition) — try to find it
          if (err?.code === 409 || err?.status === 409) {
            const refreshed = await gmail.users.labels.list({ userId: 'me' })
            const found = (refreshed.data.labels ?? []).find((l) => l.name === labelName)
            labelId = found?.id ?? undefined
            if (labelId) labelMap.set(labelName, labelId)
          } else {
            console.error(`Failed to create label ${labelName}:`, err)
            return
          }
        }
      }

      if (!labelId) return

      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id: result.messageId,
          requestBody: {
            addLabelIds: [labelId],
          },
        })
        categorySummary[result.category] = (categorySummary[result.category] ?? 0) + 1
        totalOrganized++
      } catch (err) {
        console.error(`Failed to label message ${result.messageId}:`, err)
      }
    }),
  )

  return NextResponse.json({
    results,
    totalOrganized,
    categorySummary,
  })
}, 'POST /api/email/ai/organize')
