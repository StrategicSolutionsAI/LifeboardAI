import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { getGmailForUser } from '@/lib/gmail/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SYSTEM_LABEL_ORDER: Record<string, number> = {
  INBOX: 0,
  STARRED: 1,
  SENT: 2,
  DRAFT: 3,
  SPAM: 4,
  TRASH: 5,
}

const HIDDEN_LABELS = new Set([
  'UNREAD',
  'IMPORTANT',
  'CATEGORY_PERSONAL',
  'CATEGORY_SOCIAL',
  'CATEGORY_PROMOTIONS',
  'CATEGORY_UPDATES',
  'CATEGORY_FORUMS',
  'CHAT',
])

export const GET = withAuth(async (req: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account') ?? undefined

  const gmail = await getGmailForUser(supabase, user.id, account)
  if (!gmail) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 404 })
  }

  const response = await gmail.users.labels.list({ userId: 'me' })
  const allLabels = response.data.labels ?? []

  const labels = allLabels
    .filter((l) => l.id && !HIDDEN_LABELS.has(l.id))
    .map((l) => ({
      id: l.id!,
      name: l.name ?? l.id!,
      type: l.type as 'system' | 'user',
    }))
    .sort((a, b) => {
      const aOrder = SYSTEM_LABEL_ORDER[a.id] ?? 100
      const bOrder = SYSTEM_LABEL_ORDER[b.id] ?? 100
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.name.localeCompare(b.name)
    })

  return NextResponse.json({ labels })
}, 'GET /api/email/labels')

/**
 * POST /api/email/labels — create a new Gmail label
 */
export const POST = withAuth(async (req: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account') ?? undefined

  const gmail = await getGmailForUser(supabase, user.id, account)
  if (!gmail) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 404 })
  }

  const { name, color } = await req.json()
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const result = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
      ...(color ? { color } : {}),
    },
  })

  return NextResponse.json({
    id: result.data.id,
    name: result.data.name,
    type: result.data.type,
  })
}, 'POST /api/email/labels')

/**
 * DELETE /api/email/labels — delete user labels (not system labels)
 * Body: { labelIds: string[] } — IDs of labels to delete
 */
export const DELETE = withAuth(async (req: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account') ?? undefined

  const gmail = await getGmailForUser(supabase, user.id, account)
  if (!gmail) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 404 })
  }

  const { labelIds } = await req.json()
  if (!Array.isArray(labelIds) || labelIds.length === 0) {
    return NextResponse.json({ error: 'labelIds array is required' }, { status: 400 })
  }

  // Only allow deleting user labels, never system labels
  const systemIds = new Set(Object.keys(SYSTEM_LABEL_ORDER))
  const safeIds = labelIds.filter((id: string) => !systemIds.has(id) && !HIDDEN_LABELS.has(id))

  const results: { id: string; deleted: boolean; error?: string }[] = []
  for (const id of safeIds) {
    try {
      await gmail.users.labels.delete({ userId: 'me', id })
      results.push({ id, deleted: true })
    } catch (err: any) {
      results.push({ id, deleted: false, error: err.message ?? 'Unknown error' })
    }
  }

  return NextResponse.json({ results, deletedCount: results.filter((r) => r.deleted).length })
}, 'DELETE /api/email/labels')
