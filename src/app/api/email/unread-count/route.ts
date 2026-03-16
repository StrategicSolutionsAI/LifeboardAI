import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { getGmailClient } from '@/lib/gmail/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const GET = withAuth(async (req: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account') ?? undefined

  const query = supabase
    .from('user_integrations')
    .select('token_data')
    .eq('user_id', user.id)
    .eq('provider', 'gmail')
  if (account) query.eq('provider_user_id', account)

  const { data: integration, error: integrationError } = await query.maybeSingle()

  if (integrationError || !integration?.token_data) {
    return NextResponse.json({ unreadCount: 0 })
  }

  const gmail = await getGmailClient(integration.token_data, { userId: user.id, supabase })

  const label = await gmail.users.labels.get({
    userId: 'me',
    id: 'INBOX',
  })

  return NextResponse.json({
    unreadCount: label.data.messagesUnread ?? 0,
  })
}, 'GET /api/email/unread-count')
