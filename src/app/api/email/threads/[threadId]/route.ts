import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { getGmailClient } from '@/lib/gmail/client'
import { parseGmailMessage } from '@/lib/gmail/message-parser'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/email/threads/[threadId]
 * Fetch all messages in a thread. Only the latest message gets full body parsing;
 * earlier messages return metadata only (lazy-parsed on expand in the UI).
 */
export const GET = withAuth(async (req: NextRequest, { supabase, user }, routeContext) => {
  const params = routeContext ? await routeContext.params : { threadId: '' }
  const threadId = params.threadId

  if (!threadId) {
    return NextResponse.json({ error: 'Thread ID required' }, { status: 400 })
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

  const thread = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  })

  const rawMessages = thread.data.messages ?? []
  // Only parse full body for the last (most recent) message; rest get metadata only
  const messages = rawMessages.map((msg, i) =>
    parseGmailMessage(msg, i === rawMessages.length - 1),
  )

  return NextResponse.json({ messages, threadId })
}, 'GET /api/email/threads/[threadId]')
