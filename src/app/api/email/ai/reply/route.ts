import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { withAuth } from '@/lib/api-utils'
import { getGmailForUser } from '@/lib/gmail/client'
import { parseGmailMessage } from '@/lib/gmail/message-parser'
import { runGemini } from '@/lib/replicate/client'
import { chatLimiter, getRateLimitKey } from '@/lib/rate-limit'
import { buildSmartReplyPrompt } from '@/lib/gmail/email-ai-utils'

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
  const { messageId } = body
  if (!messageId) {
    return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
  }

  // Fetch full message (need body for context)
  const msgResponse = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  })
  const parsed = parseGmailMessage(msgResponse.data, true)

  // Get user's email for personalized sign-off
  let userEmail = ''
  try {
    const profile = await gmail.users.getProfile({ userId: 'me' })
    userEmail = profile.data.emailAddress ?? ''
  } catch {
    userEmail = account ?? ''
  }

  // Build the email content for the LLM (truncate to 2000 chars)
  const emailContent = (parsed.textBody || parsed.snippet || '').slice(0, 2000)
  const emailContext = `From: ${parsed.from}
Subject: ${parsed.subject}
Date: ${parsed.date}

${emailContent}`

  const systemPrompt = buildSmartReplyPrompt(userEmail)

  let suggestedReply: string
  try {
    suggestedReply = await runGemini({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a reply to this email:\n\n${emailContext}` },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    })
  } catch (err) {
    console.error('Gemini reply error:', err instanceof Error ? err.message : String(err))
    try {
      const openai = getOpenAI()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a reply to this email:\n\n${emailContext}` },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      })
      suggestedReply = completion.choices[0]?.message?.content ?? ''
    } catch (fallbackErr) {
      console.error('OpenAI reply fallback error:', fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr))
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
    }
  }

  if (!suggestedReply) {
    return NextResponse.json({ error: 'Failed to generate reply' }, { status: 500 })
  }

  return NextResponse.json({ suggestedReply })
}, 'POST /api/email/ai/reply')
