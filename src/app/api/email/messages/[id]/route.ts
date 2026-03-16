import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { getGmailClient } from '@/lib/gmail/client'
import { parseGmailMessage } from '@/lib/gmail/message-parser'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const GET = withAuth(async (req: NextRequest, { supabase, user }, routeContext) => {
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

  const { data: integration, error: integrationError } = await query.maybeSingle()

  if (integrationError || !integration?.token_data) {
    return NextResponse.json(
      { error: 'Gmail not connected' },
      { status: 404 },
    )
  }

  const gmail = await getGmailClient(integration.token_data, { userId: user.id, supabase })

  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  })

  const parsed = parseGmailMessage(msg.data, true)

  return NextResponse.json({ message: parsed })
}, 'GET /api/email/messages/[id]')
