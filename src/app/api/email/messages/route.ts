import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { getGmailClient } from '@/lib/gmail/client'
import { parseGmailMessageSummary } from '@/lib/gmail/message-parser'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const GET = withAuth(async (req: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account') ?? undefined

  // Fetch Gmail integration tokens
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
  const maxResults = Math.min(
    parseInt(searchParams.get('maxResults') ?? '20', 10),
    50,
  )
  const pageToken = searchParams.get('pageToken') ?? undefined
  const q = searchParams.get('q') ?? undefined

  // List message IDs from inbox
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    pageToken,
    q: q || 'in:inbox',
  })

  const messageIds = listResponse.data.messages ?? []
  const nextPageToken = listResponse.data.nextPageToken ?? null

  if (messageIds.length === 0) {
    return NextResponse.json({ messages: [], nextPageToken: null })
  }

  // Batch-fetch metadata for each message
  const messages = await Promise.all(
    messageIds.map(async ({ id }) => {
      if (!id) return null
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date', 'Cc'],
      })
      return parseGmailMessageSummary(msg.data)
    }),
  )

  return NextResponse.json({
    messages: messages.filter(Boolean),
    nextPageToken,
  })
}, 'GET /api/email/messages')
