import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { getGmailClient } from '@/lib/gmail/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The Gmail label round-trip costs ~500-700ms and the sidebar polls this on
// every page mount plus every 2 minutes — serve a short-lived cached count.
// The email page pushes exact counts via the 'email-unread-changed' event, so
// staleness here only affects the polled badge.
const countCache = new Map<string, { count: number; at: number }>()
const COUNT_TTL_MS = 90_000

export const GET = withAuth(async (req: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account') ?? undefined

  const cacheKey = `${user.id}:${account ?? ''}`
  const cached = countCache.get(cacheKey)
  if (cached && Date.now() - cached.at < COUNT_TTL_MS) {
    return NextResponse.json({ unreadCount: cached.count })
  }

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

  const unreadCount = label.data.messagesUnread ?? 0
  countCache.set(cacheKey, { count: unreadCount, at: Date.now() })

  return NextResponse.json({ unreadCount })
}, 'GET /api/email/unread-count')
