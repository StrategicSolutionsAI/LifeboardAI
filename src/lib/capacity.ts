import { mapRowToTask } from '@/repositories/tasks'
import { occursOnDate } from '@/lib/task-recurrence'
import { hourSlotMinutes, responsibleUserId } from '@/lib/reminders/due-reminders'

// "What does this person have left in the tank?" — the signals the assistant
// weighs when asked to plan: last night's sleep, today's mood, cycle day, and
// how many hours are already committed each day this week. Pure functions over
// data the app already has; nothing here is a diagnosis.

export const DEFAULT_TASK_MINUTES = 60
export const HEAVY_DAY_HOURS = 8

const MOOD_LABELS: Record<string, string> = { great: 'great', good: 'good', okay: 'okay', meh: 'meh', bad: 'bad' }

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)
}

function weekday(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
}

type Widget = Record<string, any>

export function lastNightSleep(widgets: Widget[], today: string): { hours: number; quality?: number } | null {
  const entries: Array<{ date: string; duration: number; quality?: number }> =
    widgets.find((w) => Array.isArray(w?.sleepData?.entries))?.sleepData.entries ?? []
  const recent = entries
    .filter((e) => e.date === today || e.date === shiftDate(today, -1))
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  return recent && typeof recent.duration === 'number' ? { hours: recent.duration, quality: recent.quality } : null
}

export function currentMood(moodEntries: Record<string, { mood?: string | null }> | undefined, today: string): string | null {
  const entry = moodEntries?.[today] ?? moodEntries?.[shiftDate(today, -1)]
  return entry?.mood ? MOOD_LABELS[entry.mood] ?? null : null
}

export function cycleDay(widgets: Widget[], today: string): { day: number; averageLength?: number } | null {
  const data = widgets.find((w) => Array.isArray(w?.cycleData?.entries))?.cycleData
  if (!data) return null
  const starts: string[] = data.entries.filter((e: { periodStart?: boolean }) => e.periodStart).map((e: { date: string }) => e.date)
  const last = [data.lastPeriodStart, ...starts].filter(Boolean).sort().pop()
  if (!last || last > today) return null
  const day = daysBetween(last, today) + 1
  // Past ~2 cycles with no new start logged, the count is stale, not informative.
  if (day > 60) return null
  return { day, averageLength: data.averageCycleLength }
}

/** Hours of timed tasks the user is responsible for on each of the next `days` days. */
export function scheduledHoursByDay(
  rows: Array<Record<string, any>>,
  opts: { userId: string; today: string; days: number; accountByRosterId: Map<string, string> },
): Array<{ date: string; hours: number }> {
  const mine = rows.filter((row) => !row.completed && responsibleUserId(row, opts.accountByRosterId) === opts.userId)
  const tasks = mine.map((row) => mapRowToTask(row)).filter((task) => hourSlotMinutes(task.hourSlot) !== null)
  return Array.from({ length: opts.days }, (_, i) => {
    const date = shiftDate(opts.today, i)
    const minutes = tasks
      .filter((task) => task.due?.date && occursOnDate(task, date))
      .reduce((sum, task) => sum + (task.duration && task.duration > 0 ? task.duration : DEFAULT_TASK_MINUTES), 0)
    return { date, hours: Math.round((minutes / 60) * 10) / 10 }
  })
}

export function capacitySummary(opts: {
  sleep: ReturnType<typeof lastNightSleep>
  mood: string | null
  cycle: ReturnType<typeof cycleDay>
  load: Array<{ date: string; hours: number }>
}): string | null {
  const lines: string[] = []
  if (opts.sleep) {
    lines.push(`- Last night's sleep: ${opts.sleep.hours} h${opts.sleep.quality ? ` (quality ${opts.sleep.quality}/5)` : ''}`)
  }
  if (opts.mood) lines.push(`- Mood today: ${opts.mood}`)
  if (opts.cycle) {
    lines.push(`- Cycle: day ${opts.cycle.day}${opts.cycle.averageLength ? ` of about ${opts.cycle.averageLength}` : ''}`)
  }
  if (opts.load.some((d) => d.hours > 0)) {
    const days = opts.load
      .map((d, i) => `${i === 0 ? 'today' : weekday(d.date)} ${d.hours} h${d.hours >= HEAVY_DAY_HOURS ? ' (heavy)' : ''}`)
      .join(', ')
    lines.push(`- Timed commitments, next 7 days: ${days}`)
  }
  if (lines.length === 0) return null

  return [
    `\n\nCapacity (use when planning; never diagnose or give medical advice):`,
    ...lines,
    `When asked to plan a day or week, or to add something to a busy day, weigh these: after under 6 h of sleep, on a low mood, in the first days of a period, or on a day already at ${HEAVY_DAY_HOURS}+ h, suggest fewer or lighter items and moving flexible ones to lighter days, and say briefly why. Don't bring these signals up unprompted outside planning.`,
  ].join('\n')
}
