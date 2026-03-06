import { NextRequest } from 'next/server'
import { getUserPreferencesServer } from '@/lib/user-preferences-server'
import { supabaseServer } from '@/utils/supabase/server'

/**
 * Shared context builder for chat routes (text + voice).
 *
 * Fetches the authenticated user's tasks, calendar events, shopping list,
 * and step metrics, then assembles them into a system-context string the
 * LLM can reference.
 *
 * Uses `Promise.allSettled` so a single failing query (e.g. a missing table)
 * does not prevent the other context sources from loading.
 */

interface ChatContextData {
  tasks?: { content: string; due?: { date: string }; bucket?: string }[]
  calendar?: Record<string, unknown>[]
  shopping?: { name: string; quantity?: string | number; bucket?: string }[]
  steps?: number
}

export interface ChatContextResult {
  systemContext: string
  userId: string | null
}

export async function buildChatContext(
  req: NextRequest
): Promise<ChatContextResult> {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`
  const today = new Date().toISOString().split('T')[0]

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let systemContext = ''

  try {
    const prefs = await getUserPreferencesServer()
    if (!prefs) return { systemContext, userId: user?.id ?? null }

    const bucketSummary = Object.entries(prefs.widgets_by_bucket || {})
      .map(
        ([b, w]) => {
          const widgets = Array.isArray(w) ? w : []
          return `${b}: ${widgets.map((x: any) => x.name || x.type || 'widget').join(', ')}`
        }
      )
      .join('; ')

    const contextData: ChatContextData = {}

    if (user) {
      // Use allSettled so one failing query doesn't take down the rest
      const [tasksResult, calendarResult, shoppingResult] =
        await Promise.allSettled([
          supabase
            .from('lifeboard_tasks')
            .select(
              'id, content, completed, due_date, start_date, hour_slot, bucket, created_at'
            )
            .eq('user_id', user.id)
            .eq('completed', false)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('calendar_events')
            .select(
              'id, title, description, start_date, end_date, hour_slot, all_day, bucket'
            )
            .eq('user_id', user.id)
            .gte('start_date', today)
            .order('start_date', { ascending: true })
            .limit(20),
          supabase
            .from('shopping_list_items')
            .select('id, name, quantity, bucket, is_purchased')
            .eq('user_id', user.id)
            .eq('is_purchased', false)
            .order('created_at', { ascending: true })
            .limit(30),
        ])

      if (
        tasksResult.status === 'fulfilled' &&
        tasksResult.value.data
      ) {
        contextData.tasks = tasksResult.value.data.map((row: any) => ({
          content: row.content,
          due: row.due_date
            ? { date: row.due_date }
            : row.start_date
              ? { date: row.start_date }
              : undefined,
          bucket: row.bucket || undefined,
        }))
      }

      if (
        calendarResult.status === 'fulfilled' &&
        calendarResult.value.data
      ) {
        contextData.calendar = calendarResult.value.data
      }

      if (
        shoppingResult.status === 'fulfilled' &&
        shoppingResult.value.data
      ) {
        contextData.shopping = shoppingResult.value.data.map((row: any) => ({
          name: row.name,
          quantity: row.quantity,
          bucket: row.bucket,
        }))
      }
    }

    // Detect steps widget and fetch metrics
    let stepsDataSource: 'fitbit' | 'googlefit' | null = null
    for (const widgets of Object.values(prefs.widgets_by_bucket)) {
      for (const w of widgets as any[]) {
        if ((w as any).id === 'steps') {
          const ds = (w as any).dataSource ?? 'fitbit'
          stepsDataSource = ds === 'googlefit' ? 'googlefit' : 'fitbit'
          break
        }
      }
      if (stepsDataSource) break
    }

    if (stepsDataSource) {
      try {
        const metricsUrl = `${origin}/api/integrations/${stepsDataSource}/metrics?date=${today}`
        const metricsRes = await fetch(metricsUrl, {
          headers: { cookie: req.headers.get('cookie') || '' },
          cache: 'no-store',
        })
        if (metricsRes.ok) {
          const metricsJson = await metricsRes.json()
          if (typeof metricsJson.steps === 'number') {
            contextData.steps = metricsJson.steps
          }
        }
      } catch (err) {
        console.error(
          `Failed fetching ${stepsDataSource} metrics for chat context`,
          err
        )
      }
    }

    // Assemble the context string
    const contextParts = [
      `Life buckets: ${prefs.life_buckets.join(', ')}`,
      `Widgets: ${bucketSummary}`,
    ]

    if (contextData.tasks && contextData.tasks.length > 0) {
      const taskSummary = contextData.tasks
        .slice(0, 15)
        .map(
          (t) =>
            `- ${t.content}${t.due?.date ? ` (due: ${t.due.date})` : ''}${t.bucket ? ` [${t.bucket}]` : ''}`
        )
        .join('\n')
      contextParts.push(
        `\n\nCurrent Tasks (${contextData.tasks.length}):\n${taskSummary}${contextData.tasks.length > 15 ? '\n... and more' : ''}`
      )
    }

    if (contextData.calendar && contextData.calendar.length > 0) {
      const calSummary = contextData.calendar
        .slice(0, 10)
        .map(
          (e: any) =>
            `- ${e.title}${e.start_date ? ` (${e.start_date})` : ''}${e.bucket ? ` [${e.bucket}]` : ''}`
        )
        .join('\n')
      contextParts.push(
        `\n\nUpcoming Calendar Events (${contextData.calendar.length}):\n${calSummary}${contextData.calendar.length > 10 ? '\n... and more' : ''}`
      )
    }

    if (contextData.shopping && contextData.shopping.length > 0) {
      const shopSummary = contextData.shopping
        .slice(0, 10)
        .map(
          (i) =>
            `- ${i.name}${i.quantity ? ` (${i.quantity})` : ''}${i.bucket ? ` [${i.bucket}]` : ''}`
        )
        .join('\n')
      contextParts.push(
        `\n\nShopping List (${contextData.shopping.length}):\n${shopSummary}${contextData.shopping.length > 10 ? '\n... and more' : ''}`
      )
    }

    if (contextData.steps !== undefined) {
      contextParts.push(`\n\nToday's Steps: ${contextData.steps}`)
    }

    // Extract family members from widget data
    const allWidgets = Object.values(prefs.widgets_by_bucket || {}).flat() as any[]
    const familyWidget = allWidgets.find((w: any) => w?.id === 'family_members' && w?.familyMembersData?.members?.length)
    if (familyWidget) {
      const familySummary = familyWidget.familyMembersData.members
        .map((m: any) => {
          const parts = [`- ${m.name} (${m.relationship})`]
          if (m.birthday) parts.push(`birthday: ${m.birthday}`)
          if (m.allergens?.length) parts.push(`allergens: ${m.allergens.join(', ')}`)
          if (m.medicalNotes) parts.push(`medical: ${m.medicalNotes}`)
          return parts.join(' | ')
        })
        .join('\n')
      contextParts.push(`\n\nFamily Members (${familyWidget.familyMembersData.members.length}):\n${familySummary}`)
    }

    systemContext = `System: ${contextParts.join('\n')}`
  } catch (e) {
    console.error('Failed to build chat system context', e)
  }

  return { systemContext, userId: user?.id ?? null }
}
