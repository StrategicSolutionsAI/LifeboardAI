import { mapRowToTask } from '@/repositories/tasks'
import { occursOnDate } from '@/lib/task-recurrence'

/** Reminders go out between this many minutes before a task starts… */
export const REMINDER_LEAD_MINUTES = 20
/** …and this many minutes after, so a late cron run still catches it. */
export const REMINDER_GRACE_MINUTES = 10

/** The user's wall-clock date and minutes past midnight in their time zone. */
export function localNow(now: Date, timeZone: string): { date: string; minutes: number } {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now)
  } catch {
    return localNow(now, 'UTC') // unknown zone string from an old browser
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

/** "hour-9:30AM" → 570. Null for anything else. */
export function hourSlotMinutes(slot: string | null | undefined): number | null {
  const match = slot?.replace(/^hour-/, '').match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!match) return null
  let hours = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') hours += 12
  return hours * 60 + (match[2] ? Number(match[2]) : 0)
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export interface OccurrenceOverride {
  skip: boolean
  overrideHourSlot: string | null
}

/**
 * Who a task belongs to day-to-day: its assignee when that family member is a
 * linked household account, otherwise its author. Drives reminders and the
 * assistant's view of how full someone's week is.
 */
export function responsibleUserId(row: Record<string, any>, accountByRosterId: Map<string, string>): string {
  return (row.assignee_id && accountByRosterId.get(row.assignee_id)) || row.user_id
}

export interface DueReminder {
  taskId: string
  title: string
  body: string
}

/**
 * Which of these task rows should remind `recipientId` right now. A task
 * reminds its assignee when the assignee is a linked household account, and
 * its author otherwise — so a chore assigned to a partner pings the partner.
 */
export function dueReminders(
  rows: Array<Record<string, any>>,
  opts: {
    recipientId: string
    today: string
    nowMinutes: number
    overrides: Map<string, OccurrenceOverride>
    accountByRosterId: Map<string, string>
  },
): DueReminder[] {
  const due: DueReminder[] = []
  for (const row of rows) {
    if (responsibleUserId(row, opts.accountByRosterId) !== opts.recipientId) continue

    const task = mapRowToTask(row)
    if (!occursOnDate(task, opts.today)) continue

    const override = opts.overrides.get(task.id)
    if (override?.skip) continue
    const start = hourSlotMinutes(override?.overrideHourSlot ?? task.hourSlot)
    if (start === null) continue

    const minutesUntil = start - opts.nowMinutes
    if (minutesUntil > REMINDER_LEAD_MINUTES || minutesUntil < -REMINDER_GRACE_MINUTES) continue

    due.push({
      taskId: task.id,
      title: task.content,
      body: minutesUntil > 0 ? `Starts at ${formatMinutes(start)}` : `Started at ${formatMinutes(start)}`,
    })
  }
  return due
}
