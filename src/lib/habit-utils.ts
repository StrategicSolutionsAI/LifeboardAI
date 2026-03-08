/**
 * Shared habit-tracking utilities used by:
 * - habit-tracker-widget.tsx (dashboard widget card/modal)
 * - habit-checklist-panel.tsx (calendar sidebar Habits tab)
 * - use-dashboard-widgets.ts (toggle handler)
 */

import type { WidgetInstance } from '@/types/widgets'

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns `YYYY-MM-DD` in the user's **local** timezone. */
export function getDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Returns an array of 7 date keys from 6 days ago through today (local time). */
export function getLast7Days(): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    keys.push(getDateKey(d))
  }
  return keys
}

// ---------------------------------------------------------------------------
// Streak calculation
// ---------------------------------------------------------------------------

/**
 * Walks backwards from today counting consecutive completed *scheduled* days.
 * When `schedule` is provided (boolean[7], Sun=0..Sat=6), only scheduled days
 * are considered — off-days are skipped (they don't break the streak).
 * Grace period: the most recent scheduled day doesn't need to be completed yet
 * (mirrors the today/yesterday rule from the non-schedule path).
 */
export function calculateStreak(
  completionHistory: string[],
  schedule?: boolean[],
): number {
  const today = getDateKey(new Date())

  // Filter out dates after today (can happen from legacy UTC storage)
  const completionSet = new Set(
    completionHistory.filter(d => d <= today)
  )

  if (completionSet.size === 0) return 0

  // Helper: is this day a scheduled day?
  const isScheduledDay = (dateKey: string): boolean => {
    if (!schedule || schedule.length < 7) return true // no schedule = every day
    const dow = new Date(dateKey + 'T12:00:00').getDay()
    return schedule[dow]
  }

  // Walk backwards from today, collecting scheduled days
  let streak = 0
  let graceUsed = false
  const cursor = new Date()

  for (let i = 0; i < 400; i++) { // safety limit
    const key = getDateKey(cursor)
    if (isScheduledDay(key)) {
      if (completionSet.has(key)) {
        streak++
      } else if (!graceUsed) {
        // Grace: skip the most recent scheduled day if it's not completed
        graceUsed = true
      } else {
        break
      }
    }
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

/**
 * Counts the number of scheduled days elapsed between `startDate` and today
 * (inclusive). When no schedule is provided, returns total calendar days.
 */
export function countScheduledDaysSince(
  startDate: string,
  schedule?: boolean[],
): number {
  const today = new Date()
  const start = new Date(startDate + 'T12:00:00')
  const todayNoon = new Date(
    today.getFullYear(), today.getMonth(), today.getDate(), 12
  )

  if (start > todayNoon) return 1 // hasn't started yet

  let count = 0
  const cursor = new Date(start)
  while (cursor <= todayNoon) {
    if (!schedule || schedule.length < 7 || schedule[cursor.getDay()]) {
      count++
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return Math.max(1, count)
}

/**
 * Fires a burst of confetti. Dynamically imports canvas-confetti to keep
 * it out of the main bundle.
 */
export async function fireConfetti(): Promise<void> {
  try {
    const confetti = (await import('canvas-confetti')).default
    confetti({
      particleCount: 60,
      spread: 55,
      origin: { y: 0.7 },
      colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
    })
  } catch {
    // canvas-confetti not available — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Toggle payload builder
// ---------------------------------------------------------------------------

export const DEFAULT_MILESTONES = [
  { days: 7, label: '1 Week', emoji: '\u2B50', achieved: false },
  { days: 14, label: '2 Weeks', emoji: '\uD83C\uDF1F', achieved: false },
  { days: 21, label: '21 Days', emoji: '\uD83D\uDCAA', achieved: false },
  { days: 30, label: '1 Month', emoji: '\uD83D\uDD25', achieved: false },
  { days: 60, label: '2 Months', emoji: '\uD83C\uDFC6', achieved: false },
  { days: 90, label: '3 Months', emoji: '\uD83D\uDC51', achieved: false },
  { days: 180, label: '6 Months', emoji: '\uD83D\uDC8E', achieved: false },
  { days: 365, label: '1 Year', emoji: '\uD83C\uDFAF', achieved: false },
]

/**
 * Builds the partial `{ habitTrackerData }` update for toggling today's
 * completion on a habit widget. Returns `null` if `habitTrackerData` is
 * missing on the widget.
 */
export function buildTogglePayload(
  widget: WidgetInstance,
  isCompletedToday: boolean,
): Pick<WidgetInstance, 'habitTrackerData'> | null {
  const habitData = widget.habitTrackerData
  if (!habitData) return null

  const today = getDateKey(new Date())
  const history = [...(habitData.completionHistory || [])]
  let totalCompletions = habitData.totalCompletions || 0

  if (isCompletedToday) {
    // Undo today
    const idx = history.lastIndexOf(today)
    if (idx !== -1) history.splice(idx, 1)
    totalCompletions = Math.max(0, totalCompletions - 1)
  } else {
    // Complete today (guard against duplicate from rapid double-click)
    if (!history.includes(today)) {
      history.push(today)
      totalCompletions++
    }
  }

  const schedule = widget.schedule as boolean[] | undefined
  const newStreak = calculateStreak(history, schedule)
  const newBestStreak = Math.max(habitData.bestStreak || 0, newStreak)

  const updatedMilestones = (habitData.milestones || DEFAULT_MILESTONES).map((m) => {
    if (!m.achieved && newStreak >= m.days) {
      return { ...m, achieved: true, achievedDate: today }
    }
    return m
  })

  return {
    habitTrackerData: {
      ...habitData,
      completionHistory: history,
      totalCompletions,
      bestStreak: newBestStreak,
      milestones: updatedMilestones,
    },
  }
}
