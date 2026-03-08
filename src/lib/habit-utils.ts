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
 * Walks backwards from today (or yesterday if today isn't completed)
 * counting consecutive completed days.
 */
export function calculateStreak(completionHistory: string[]): number {
  const unique = Array.from(new Set(completionHistory)).sort().reverse()
  const today = getDateKey(new Date())
  const yesterday = getDateKey(new Date(Date.now() - 86400000))

  if (!unique.length || (unique[0] !== today && unique[0] !== yesterday)) return 0

  let streak = 0
  let expected = unique[0]
  for (const date of unique) {
    if (date === expected) {
      streak++
      const d = new Date(expected + 'T12:00:00')
      d.setDate(d.getDate() - 1)
      expected = getDateKey(d)
    } else {
      break
    }
  }
  return streak
}

// ---------------------------------------------------------------------------
// Toggle payload builder
// ---------------------------------------------------------------------------

const DEFAULT_MILESTONES = [
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

  const newStreak = calculateStreak(history)
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
