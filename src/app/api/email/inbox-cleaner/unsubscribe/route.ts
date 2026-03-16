import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { getGmailForUser } from '@/lib/gmail/client'
import { apiLimiter, getRateLimitKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Parse a mailto: URI into { to, subject, body }.
 * Format: mailto:unsub@example.com?subject=Unsubscribe&body=...
 */
function parseMailto(mailto: string): { to: string; subject: string; body: string } {
  const withoutScheme = mailto.replace(/^mailto:/i, '')
  const [address, queryString] = withoutScheme.split('?', 2)
  const params = new URLSearchParams(queryString || '')
  return {
    to: decodeURIComponent(address || ''),
    subject: params.get('subject') || 'Unsubscribe',
    body: params.get('body') || 'Unsubscribe',
  }
}

/**
 * Build a raw RFC 2822 message and base64url-encode it for Gmail API.
 */
function buildRawEmail(to: string, subject: string, body: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n')

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export const POST = withAuth(async (req: NextRequest, { supabase, user }) => {
  const rateLimited = apiLimiter.check(getRateLimitKey(req))
  if (rateLimited) return rateLimited

  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account') ?? undefined

  const body = await req.json()
  const {
    senderEmail,
    unsubscribeUrl,
    unsubscribeMailto,
    hasOneClick,
    deleteEmails,
  } = body as {
    senderEmail: string
    unsubscribeUrl?: string | null
    unsubscribeMailto?: string | null
    hasOneClick?: boolean
    deleteEmails?: boolean
  }

  if (!senderEmail) {
    return NextResponse.json({ error: 'senderEmail is required' }, { status: 400 })
  }

  let unsubscribeMethod: string | null = null
  let deletedCount = 0

  // ── Unsubscribe ──────────────────────────────────────────────────────

  // Strategy 1: One-click unsubscribe (RFC 8058)
  if (hasOneClick && unsubscribeUrl) {
    try {
      const res = await fetch(unsubscribeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
        redirect: 'follow',
      })
      if (res.ok || res.status === 204) {
        unsubscribeMethod = 'one-click'
      } else {
        console.warn(`One-click failed for ${senderEmail}: HTTP ${res.status}`)
      }
    } catch (err) {
      console.warn(`One-click error for ${senderEmail}:`, err)
    }
  }

  // Strategy 2: HTTP URL — GET request server-side
  if (!unsubscribeMethod && unsubscribeUrl) {
    try {
      const res = await fetch(unsubscribeUrl, {
        method: 'GET',
        redirect: 'follow',
      })
      if (res.ok) {
        unsubscribeMethod = 'http'
      } else {
        console.warn(`HTTP unsubscribe failed for ${senderEmail}: HTTP ${res.status}`)
        // Still mark as done — many unsubscribe pages return non-200 but still process
        unsubscribeMethod = 'http'
      }
    } catch (err) {
      console.warn(`HTTP unsubscribe error for ${senderEmail}:`, err)
      // Fall through to mailto
    }
  }

  // Strategy 3: Mailto — send unsubscribe email via Gmail API
  if (!unsubscribeMethod && unsubscribeMailto) {
    try {
      const gmail = await getGmailForUser(supabase, user.id, account)
      if (gmail) {
        const { to, subject, body: mailBody } = parseMailto(unsubscribeMailto)
        const raw = buildRawEmail(to, subject, mailBody)
        await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw },
        })
        unsubscribeMethod = 'mailto'
      }
    } catch (err) {
      console.warn(`Mailto unsubscribe error for ${senderEmail}:`, err)
    }
  }

  // ── Delete emails from sender ────────────────────────────────────────

  if (deleteEmails) {
    try {
      const gmail = await getGmailForUser(supabase, user.id, account)
      if (gmail) {
        // Find all messages from this sender
        const messageIds: string[] = []
        let pageToken: string | undefined

        // Paginate to collect all message IDs (up to 1000)
        for (let page = 0; page < 5; page++) {
          const listRes = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 200,
            pageToken,
            q: `from:${senderEmail}`,
          })
          const ids = (listRes.data.messages ?? [])
            .map((m) => m.id)
            .filter((id): id is string => !!id)
          messageIds.push(...ids)
          pageToken = listRes.data.nextPageToken ?? undefined
          if (!pageToken) break
        }

        // Batch trash in chunks of 1000 (Gmail API limit)
        if (messageIds.length > 0) {
          const BATCH = 1000
          for (let i = 0; i < messageIds.length; i += BATCH) {
            const chunk = messageIds.slice(i, i + BATCH)
            await gmail.users.messages.batchModify({
              userId: 'me',
              requestBody: {
                ids: chunk,
                addLabelIds: ['TRASH'],
                removeLabelIds: ['INBOX'],
              },
            })
          }
          deletedCount = messageIds.length
        }
      }
    } catch (err) {
      console.warn(`Delete emails error for ${senderEmail}:`, err)
    }
  }

  if (!unsubscribeMethod && !deleteEmails) {
    return NextResponse.json({
      success: false,
      error: 'No unsubscribe method available for this sender',
      senderEmail,
    })
  }

  return NextResponse.json({
    success: true,
    method: unsubscribeMethod,
    senderEmail,
    deletedCount,
  })
}, 'POST /api/email/inbox-cleaner/unsubscribe')
