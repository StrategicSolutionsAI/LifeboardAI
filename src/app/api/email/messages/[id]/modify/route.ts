import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { getGmailClient } from '@/lib/gmail/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PATCH /api/email/messages/[id]/modify
 * Modify label state on a message: read/unread, archive, trash.
 *
 * Body: { action: 'markRead' | 'markUnread' | 'archive' | 'trash' | 'untrash' }
 */
export const PATCH = withAuth(async (req: NextRequest, { supabase, user }, routeContext) => {
  const params = routeContext ? await routeContext.params : { id: '' }
  const messageId = params.id

  if (!messageId) {
    return NextResponse.json({ error: 'Message ID required' }, { status: 400 })
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

  const { action, labelId } = await req.json()

  let addLabelIds: string[] = []
  let removeLabelIds: string[] = []

  switch (action) {
    case 'markRead':
      removeLabelIds = ['UNREAD']
      break
    case 'markUnread':
      addLabelIds = ['UNREAD']
      break
    case 'archive':
      removeLabelIds = ['INBOX']
      break
    case 'trash':
      await gmail.users.messages.trash({ userId: 'me', id: messageId })
      return NextResponse.json({ success: true })
    case 'untrash':
      await gmail.users.messages.untrash({ userId: 'me', id: messageId })
      return NextResponse.json({ success: true })
    case 'star':
      addLabelIds = ['STARRED']
      break
    case 'unstar':
      removeLabelIds = ['STARRED']
      break
    case 'addLabel':
      if (!labelId) return NextResponse.json({ error: 'labelId required' }, { status: 400 })
      addLabelIds = [labelId]
      break
    case 'removeLabel':
      if (!labelId) return NextResponse.json({ error: 'labelId required' }, { status: 400 })
      removeLabelIds = [labelId]
      break
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { addLabelIds, removeLabelIds },
  })

  return NextResponse.json({ success: true })
}, 'PATCH /api/email/messages/[id]/modify')
