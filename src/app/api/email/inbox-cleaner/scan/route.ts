import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { getGmailClient } from '@/lib/gmail/client'
import {
  getHeader,
  extractSenderEmail,
  extractSenderName,
  parseListUnsubscribe,
} from '@/lib/gmail/message-parser'
import { apiLimiter, getRateLimitKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export interface SenderGroup {
  senderEmail: string
  senderName: string
  emailCount: number
  lastSeenDate: string
  unsubscribeUrl: string | null
  unsubscribeMailto: string | null
  hasOneClick: boolean
  sampleMessageId: string
}

export const POST = withAuth(async (req: NextRequest, { supabase, user }) => {
  const rateLimited = apiLimiter.check(getRateLimitKey(req))
  if (rateLimited) return rateLimited

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
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 404 })
  }

  const gmail = await getGmailClient(integration.token_data, { userId: user.id, supabase })

  // Paginate up to 500 promotional messages (3 pages of ~200)
  const allMessageIds: { id: string }[] = []
  let pageToken: string | undefined
  const MAX_PAGES = 3
  const PAGE_SIZE = 200

  for (let page = 0; page < MAX_PAGES; page++) {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: PAGE_SIZE,
      pageToken,
      q: 'category:promotions',
    })

    const ids = (listRes.data.messages ?? [])
      .filter((m): m is { id: string } => !!m.id)
    allMessageIds.push(...ids)

    pageToken = listRes.data.nextPageToken ?? undefined
    if (!pageToken) break
  }

  if (allMessageIds.length === 0) {
    return NextResponse.json({
      senders: [],
      totalPromotionalEmails: 0,
      scannedCount: 0,
    })
  }

  // Fetch metadata in chunks of 50
  const CHUNK_SIZE = 50
  const senderMap = new Map<string, SenderGroup>()

  for (let i = 0; i < allMessageIds.length; i += CHUNK_SIZE) {
    const chunk = allMessageIds.slice(i, i + CHUNK_SIZE)
    const results = await Promise.all(
      chunk.map(async ({ id }) => {
        try {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: [
              'From',
              'Date',
              'List-Unsubscribe',
              'List-Unsubscribe-Post',
            ],
          })
          return msg.data
        } catch {
          return null
        }
      }),
    )

    for (const msg of results) {
      if (!msg?.payload?.headers) continue

      const from = getHeader(msg.payload.headers, 'From')
      const date = getHeader(msg.payload.headers, 'Date')
      const listUnsub = getHeader(msg.payload.headers, 'List-Unsubscribe')
      const listUnsubPost = getHeader(msg.payload.headers, 'List-Unsubscribe-Post')

      const email = extractSenderEmail(from).toLowerCase()
      if (!email) continue

      const existing = senderMap.get(email)
      const { httpUrl, mailto } = parseListUnsubscribe(listUnsub)
      const hasOneClick = !!(
        httpUrl &&
        listUnsubPost?.toLowerCase().includes('list-unsubscribe=one-click')
      )

      if (existing) {
        existing.emailCount++
        // Keep the newest date
        if (date && new Date(date) > new Date(existing.lastSeenDate)) {
          existing.lastSeenDate = date
        }
        // Prefer having unsubscribe info
        if (!existing.unsubscribeUrl && httpUrl) {
          existing.unsubscribeUrl = httpUrl
        }
        if (!existing.unsubscribeMailto && mailto) {
          existing.unsubscribeMailto = mailto
        }
        if (!existing.hasOneClick && hasOneClick) {
          existing.hasOneClick = true
        }
      } else {
        senderMap.set(email, {
          senderEmail: email,
          senderName: extractSenderName(from),
          emailCount: 1,
          lastSeenDate: date,
          unsubscribeUrl: httpUrl,
          unsubscribeMailto: mailto,
          hasOneClick,
          sampleMessageId: msg.id ?? '',
        })
      }
    }
  }

  // Sort by count descending
  const senders = Array.from(senderMap.values()).sort(
    (a, b) => b.emailCount - a.emailCount,
  )

  return NextResponse.json({
    senders,
    totalPromotionalEmails: allMessageIds.length,
    scannedCount: allMessageIds.length,
  })
}, 'POST /api/email/inbox-cleaner/scan')
