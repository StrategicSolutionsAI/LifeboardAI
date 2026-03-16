import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { getGmailClient } from '@/lib/gmail/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/email/messages/[id]/attachments/[attachmentId]
 * Download an attachment from a Gmail message.
 *
 * Query: ?filename=...&mimeType=...
 */
export const GET = withAuth(async (req: NextRequest, { supabase, user }, routeContext) => {
  const params = routeContext ? await routeContext.params : { id: '', attachmentId: '' }
  const messageId = params.id
  const attachmentId = params.attachmentId

  if (!messageId || !attachmentId) {
    return NextResponse.json({ error: 'Message ID and attachment ID required' }, { status: 400 })
  }

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

  const attachment = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  })

  if (!attachment.data.data) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  }

  // Gmail returns base64url-encoded data
  const base64 = attachment.data.data.replace(/-/g, '+').replace(/_/g, '/')
  const buffer = Buffer.from(base64, 'base64')

  const filename = searchParams.get('filename') || 'attachment'
  const mimeType = searchParams.get('mimeType') || 'application/octet-stream'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  })
}, 'GET /api/email/messages/[id]/attachments/[attachmentId]')
