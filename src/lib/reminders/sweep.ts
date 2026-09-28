import { TASK_SELECT_COLUMNS } from '@/repositories/tasks'
import { getDataScope, ownedOrShared } from '@/lib/household/scope'
import { dueReminders, localNow, type OccurrenceOverride } from './due-reminders'
import { sendPush, type StoredSubscription } from './web-push'

interface SubscriptionRow extends StoredSubscription {
  id: string
  user_id: string
  time_zone: string
}

export interface SweepResult {
  users: number
  sent: number
  removedSubscriptions: number
}

/**
 * One reminder pass over every user with push turned on. Runs with the
 * service-role client, which bypasses RLS — every task query is scoped
 * explicitly with ownedOrShared(), exactly as the user's own requests are.
 */
export async function runReminderSweep(admin: any, now = new Date()): Promise<SweepResult> {
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, time_zone')
  if (error) throw error

  const byUser = new Map<string, SubscriptionRow[]>()
  for (const sub of (subs ?? []) as SubscriptionRow[]) {
    byUser.set(sub.user_id, [...(byUser.get(sub.user_id) ?? []), sub])
  }

  const result: SweepResult = { users: byUser.size, sent: 0, removedSubscriptions: 0 }

  for (const [userId, userSubs] of Array.from(byUser)) {
    const { date, minutes } = localNow(now, userSubs[0].time_zone)
    const scope = await getDataScope(admin, userId)

    const [{ data: tasks }, rosterResult] = await Promise.all([
      admin
        .from('lifeboard_tasks')
        .select(TASK_SELECT_COLUMNS)
        .or(ownedOrShared(scope))
        .eq('completed', false)
        .not('hour_slot', 'is', null),
      scope.householdId
        ? admin.from('households').select('family_roster').eq('id', scope.householdId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    if (!tasks?.length) continue

    const accountByRosterId = new Map<string, string>()
    for (const member of (rosterResult.data?.family_roster ?? []) as Array<{ id: string; userId?: string }>) {
      if (member.userId) accountByRosterId.set(member.id, member.userId)
    }

    const { data: exceptionRows } = await admin
      .from('task_occurrence_exceptions')
      .select('task_id, skip, override_hour_slot')
      .in('task_id', tasks.map((t: { id: string }) => t.id))
      .eq('occurrence_date', date)
    const overrides = new Map<string, OccurrenceOverride>()
    for (const row of exceptionRows ?? []) {
      overrides.set(row.task_id, { skip: row.skip, overrideHourSlot: row.override_hour_slot })
    }

    const due = dueReminders(tasks, { recipientId: userId, today: date, nowMinutes: minutes, overrides, accountByRosterId })

    for (const reminder of due) {
      // Claim first: a duplicate key means an earlier or concurrent run sent it.
      const { error: claimError } = await admin
        .from('task_reminder_log')
        .insert({ task_id: reminder.taskId, recipient_id: userId, occurrence_date: date })
      if (claimError) {
        if (claimError.code !== '23505') console.error('Reminder claim failed', claimError)
        continue
      }

      for (const sub of userSubs) {
        const outcome = await sendPush(sub, {
          title: reminder.title,
          body: reminder.body,
          url: '/calendar',
          tag: `task-${reminder.taskId}-${date}`,
        })
        if (outcome === 'sent') result.sent += 1
        if (outcome === 'gone') {
          await admin.from('push_subscriptions').delete().eq('id', sub.id)
          result.removedSubscriptions += 1
        }
      }
    }
  }

  return result
}
