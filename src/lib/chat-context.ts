import { NextRequest } from 'next/server'
import { getRequestOrigin } from '@/lib/api-utils'
import { getUserPreferencesServer } from '@/lib/user-preferences-server'
import { getUserCached } from '@/lib/server-auth-cache'
import { getDataScope, ownedOrShared } from '@/lib/household/scope'
import { TASK_SELECT_COLUMNS } from '@/repositories/tasks'
import { CLIENT_DATE_HEADER } from '@/lib/date-utils'
import { capacitySummary, currentMood, cycleDay, lastNightSleep, scheduledHoursByDay } from '@/lib/capacity'
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
}

export async function buildChatContext(
  req: NextRequest
): Promise<ChatContextResult> {
  const origin = getRequestOrigin(req)
  // The client's local date; the server's UTC date is a day ahead on US evenings.
  const clientDate = req.headers.get(CLIENT_DATE_HEADER)
  const today = clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate) ? clientDate : new Date().toISOString().split('T')[0]

  const supabase = supabaseServer()
  // Cached validation — the route wrapper already verified this token
  const {
    data: { user },
  } = await getUserCached(supabase)

  let systemContext = ''

  try {
    // Prefs and the dashboard queries are independent — run them concurrently
    const prefsPromise = getUserPreferencesServer()
    const scope = user ? await getDataScope(supabase, user.id) : null
    const batchPromise = user && scope
      ? Promise.allSettled([
          supabase
            .from('lifeboard_tasks')
            .select(
              'id, content, completed, due_date, start_date, hour_slot, bucket, created_at'
            )
            .or(ownedOrShared(scope))
            .eq('completed', false)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('calendar_events')
            .select(
              'id, title, description, start_date, end_date, hour_slot, all_day, bucket'
            )
            .or(ownedOrShared(scope))
            .gte('start_date', today)
            .order('start_date', { ascending: true })
            .limit(20),
          // Timed tasks feed the capacity summary (hours committed per day)
          supabase
            .from('lifeboard_tasks')
            .select(TASK_SELECT_COLUMNS)
            .or(ownedOrShared(scope))
            .eq('completed', false)
            .not('hour_slot', 'is', null)
            .limit(500),
          supabase
            .from('shopping_list_items')
            .select('id, name, quantity, bucket, is_purchased')
            .or(ownedOrShared(scope))
            .eq('is_purchased', false)
            .order('created_at', { ascending: true })
            .limit(30),
        ])
      : null

    const householdRosterPromise = scope?.householdId
      ? supabase.from('households').select('family_roster').eq('id', scope.householdId).maybeSingle()
          .then(({ data }) => (Array.isArray(data?.family_roster) ? data.family_roster : null))
      : Promise.resolve(null)
    const prefs = await prefsPromise
    const householdRoster: any[] | null = await householdRosterPromise
    if (!prefs) return { systemContext }

    const bucketSummary = Object.entries(prefs.widgets_by_bucket || {})
      .map(
        ([b, w]) => {
          const widgets = Array.isArray(w) ? w : []
          return `${b}: ${widgets.map((x: any) => x.name || x.type || 'widget').join(', ')}`
        }
      )
      .join('; ')

    const contextData: ChatContextData = {}
    let timedTaskRows: Array<Record<string, any>> = []

    // Steps depend only on prefs — start the metrics fetch now so it overlaps
    // the dashboard-query batch instead of running after it
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

    const stepsPromise = stepsDataSource
      ? (async (ds: 'fitbit' | 'googlefit') => {
          try {
            const metricsRes = await fetch(
              `${origin}/api/integrations/${ds}/metrics?date=${today}`,
              {
                headers: { cookie: req.headers.get('cookie') || '' },
                cache: 'no-store',
              }
            )
            if (metricsRes.ok) {
              const metricsJson = await metricsRes.json()
              if (typeof metricsJson.steps === 'number') {
                return metricsJson.steps as number
              }
            }
          } catch (err) {
            console.error(`Failed fetching ${ds} metrics for chat context`, err)
          }
          return undefined
        })(stepsDataSource)
      : null

    if (batchPromise) {
      const [tasksResult, calendarResult, timedResult, shoppingResult] = await batchPromise
      if (timedResult.status === 'fulfilled' && timedResult.value.data) {
        timedTaskRows = timedResult.value.data
      }

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

    if (stepsPromise) {
      const steps = await stepsPromise
      if (steps !== undefined) contextData.steps = steps
    }

    const allWidgetsForCapacity = Object.values(prefs.widgets_by_bucket || {}).flat() as any[]

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

    // Capacity: sleep, mood, cycle day and this week's committed hours
    if (user) {
      const accountByRosterId = new Map<string, string>(
        (householdRoster ?? []).filter((m: any) => m?.userId).map((m: any) => [m.id, m.userId]),
      )
      const capacity = capacitySummary({
        sleep: lastNightSleep(allWidgetsForCapacity, today),
        mood: currentMood(prefs.mood_entries, today),
        cycle: cycleDay(allWidgetsForCapacity, today),
        load: scheduledHoursByDay(timedTaskRows, { userId: user.id, today, days: 7, accountByRosterId }),
      })
      if (capacity) contextParts.push(capacity)
    }

    // Family members: the household's shared roster, else the widget's own
    const allWidgets = Object.values(prefs.widgets_by_bucket || {}).flat() as any[]
    const familyWidget = allWidgets.find((w: any) => w?.id === 'family_members' && w?.familyMembersData?.members?.length)
    const roster: any[] = householdRoster ?? familyWidget?.familyMembersData?.members ?? []
    if (roster.length > 0) {
      const familySummary = roster
        .map((m: any) => {
          const parts = [`- ${m.name} (${m.relationship})`]
          if (m.birthday) parts.push(`birthday: ${m.birthday}`)
          if (m.allergens?.length) parts.push(`allergens: ${m.allergens.join(', ')}`)
          if (m.medicalNotes) parts.push(`medical: ${m.medicalNotes}`)
          return parts.join(' | ')
        })
        .join('\n')
      contextParts.push(`\n\nFamily Members (${roster.length}):\n${familySummary}`)
    }

    systemContext = `System: ${contextParts.join('\n')}`
  } catch (e) {
    console.error('Failed to build chat system context', e)
  }

  return { systemContext }
}
