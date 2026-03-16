import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { getGmailForUser } from '@/lib/gmail/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function buildRawMessage(fields: {
  to?: string
  cc?: string
  bcc?: string
  subject?: string
  body?: string
  inReplyTo?: string
  references?: string
}): string {
  const lines: string[] = []
  if (fields.to) lines.push(`To: ${fields.to}`)
  if (fields.cc) lines.push(`Cc: ${fields.cc}`)
  if (fields.bcc) lines.push(`Bcc: ${fields.bcc}`)
  if (fields.subject) lines.push(`Subject: ${fields.subject}`)
  lines.push('MIME-Version: 1.0')
  lines.push('Content-Type: text/html; charset=UTF-8')
  if (fields.inReplyTo) lines.push(`In-Reply-To: ${fields.inReplyTo}`)
  if (fields.references) lines.push(`References: ${fields.references}`)
  lines.push('', fields.body || '')
  return lines.join('\r\n')
}

function base64UrlEncode(raw: string): string {
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * GET /api/email/drafts — list drafts
 */
export const GET = withAuth(async (req: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account') ?? undefined

  const gmail = await getGmailForUser(supabase, user.id, account)
  if (!gmail) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 404 })
  }

  const response = await gmail.users.drafts.list({ userId: 'me', maxResults: 20 })
  const drafts = response.data.drafts ?? []

  return NextResponse.json({
    drafts: drafts.map((d) => ({
      draftId: d.id,
      messageId: d.message?.id,
    })),
  })
}, 'GET /api/email/drafts')

/**
 * POST /api/email/drafts — create a new draft
 */
export const POST = withAuth(async (req: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account') ?? undefined

  const gmail = await getGmailForUser(supabase, user.id, account)
  if (!gmail) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 404 })
  }

  const { to, cc, bcc, subject, body, inReplyTo, references, threadId } = await req.json()

  const raw = base64UrlEncode(buildRawMessage({ to, cc, bcc, subject, body, inReplyTo, references }))

  const result = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw,
        ...(threadId ? { threadId } : {}),
      },
    },
  })

  return NextResponse.json({
    draftId: result.data.id,
    messageId: result.data.message?.id,
  })
}, 'POST /api/email/drafts')

/**
 * PUT /api/email/drafts — update an existing draft
 */
export const PUT = withAuth(async (req: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account') ?? undefined

  const gmail = await getGmailForUser(supabase, user.id, account)
  if (!gmail) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 404 })
  }

  const { draftId, to, cc, bcc, subject, body, inReplyTo, references, threadId } = await req.json()

  if (!draftId) {
    return NextResponse.json({ error: 'draftId required' }, { status: 400 })
  }

  const raw = base64UrlEncode(buildRawMessage({ to, cc, bcc, subject, body, inReplyTo, references }))

  const result = await gmail.users.drafts.update({
    userId: 'me',
    id: draftId,
    requestBody: {
      message: {
        raw,
        ...(threadId ? { threadId } : {}),
      },
    },
  })

  return NextResponse.json({
    draftId: result.data.id,
    messageId: result.data.message?.id,
  })
}, 'PUT /api/email/drafts')

/**
 * DELETE /api/email/drafts?draftId=xxx — delete a draft
 */
export const DELETE = withAuth(async (req: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(req.url)
  const draftId = searchParams.get('draftId')
  const account = searchParams.get('account') ?? undefined

  if (!draftId) {
    return NextResponse.json({ error: 'draftId required' }, { status: 400 })
  }

  const gmail = await getGmailForUser(supabase, user.id, account)
  if (!gmail) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 404 })
  }

  await gmail.users.drafts.delete({ userId: 'me', id: draftId })

  return NextResponse.json({ success: true })
}, 'DELETE /api/email/drafts')
