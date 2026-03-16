import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { getGmailClient } from '@/lib/gmail/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BOUNDARY = '----LifeboardMailBoundary'

/**
 * POST /api/email/send
 * Send an email (new, reply, or forward).
 *
 * Accepts either:
 *  - JSON body: { to, cc?, bcc?, subject, body, inReplyTo?, references?, threadId? }
 *  - FormData: text fields + file attachments
 */
export const POST = withAuth(async (req: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account') ?? undefined

  const query = supabase
    .from('user_integrations')
    .select('token_data')
    .eq('user_id', user.id)
    .eq('provider', 'gmail')
  if (account) query.eq('provider_user_id', account)

  const { data: integration } = await query.maybeSingle()

  if (!integration?.token_data) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 404 })
  }

  const gmail = await getGmailClient(integration.token_data, { userId: user.id, supabase })

  let to: string
  let cc: string | undefined
  let bcc: string | undefined
  let subject: string
  let body: string
  let inReplyTo: string | undefined
  let references: string | undefined
  let threadId: string | undefined
  let draftId: string | undefined
  let attachments: File[] = []

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    to = formData.get('to') as string ?? ''
    cc = (formData.get('cc') as string) || undefined
    bcc = (formData.get('bcc') as string) || undefined
    subject = formData.get('subject') as string ?? ''
    body = formData.get('body') as string ?? ''
    inReplyTo = (formData.get('inReplyTo') as string) || undefined
    references = (formData.get('references') as string) || undefined
    threadId = (formData.get('threadId') as string) || undefined
    draftId = (formData.get('draftId') as string) || undefined
    attachments = formData.getAll('attachments') as File[]
  } else {
    const json = await req.json()
    to = json.to
    cc = json.cc || undefined
    bcc = json.bcc || undefined
    subject = json.subject
    body = json.body
    inReplyTo = json.inReplyTo || undefined
    references = json.references || undefined
    threadId = json.threadId || undefined
    draftId = json.draftId || undefined
  }

  if (!to || !subject) {
    return NextResponse.json(
      { error: 'to and subject are required' },
      { status: 400 },
    )
  }

  let rawMessage: string

  if (attachments.length > 0) {
    // Build multipart/mixed MIME message with attachments
    const headerLines: string[] = [
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      ...(bcc ? [`Bcc: ${bcc}`] : []),
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${BOUNDARY}"`,
    ]
    if (inReplyTo) headerLines.push(`In-Reply-To: ${inReplyTo}`)
    if (references) headerLines.push(`References: ${references}`)

    const parts: string[] = []

    // HTML body part
    parts.push(
      `--${BOUNDARY}\r\n` +
      'Content-Type: text/html; charset=UTF-8\r\n' +
      'Content-Transfer-Encoding: 7bit\r\n\r\n' +
      (body || '')
    )

    // Attachment parts
    for (const file of attachments) {
      const arrayBuffer = await file.arrayBuffer()
      const base64Content = Buffer.from(arrayBuffer).toString('base64')
      parts.push(
        `--${BOUNDARY}\r\n` +
        `Content-Type: ${file.type || 'application/octet-stream'}; name="${file.name}"\r\n` +
        'Content-Transfer-Encoding: base64\r\n' +
        `Content-Disposition: attachment; filename="${file.name}"\r\n\r\n` +
        base64Content
      )
    }

    rawMessage = headerLines.join('\r\n') + '\r\n\r\n' +
      parts.join('\r\n') + '\r\n' +
      `--${BOUNDARY}--`
  } else {
    // Simple single-part message
    const lines: string[] = [
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      ...(bcc ? [`Bcc: ${bcc}`] : []),
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
    ]
    if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`)
    if (references) lines.push(`References: ${references}`)
    lines.push('', body || '')
    rawMessage = lines.join('\r\n')
  }

  // Base64url encode for Gmail API
  const encoded = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encoded,
      ...(threadId ? { threadId } : {}),
    },
  })

  // Delete draft if one existed
  if (draftId) {
    try {
      await gmail.users.drafts.delete({ userId: 'me', id: draftId })
    } catch {
      // Non-critical — draft may already be cleaned up by Gmail
    }
  }

  return NextResponse.json({
    messageId: result.data.id,
    threadId: result.data.threadId,
  })
}, 'POST /api/email/send')
