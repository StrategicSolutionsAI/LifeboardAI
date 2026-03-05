"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Target,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Award,
  TrendingUp,
  Calendar,
} from "lucide-react"
import type { WidgetInstance } from "@/types/widgets"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HabitTrackerWidgetProps {
  widget: WidgetInstance
  onUpdate: (updates: Partial<WidgetInstance>) => void
  progress: { value: number; streak: number; isToday: boolean }
  onComplete: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_MILESTONES = [
  { days: 7, label: "1 Week", emoji: "\u2B50", achieved: false },
  { days: 14, label: "2 Weeks", emoji: "\uD83C\uDF1F", achieved: false },
  { days: 21, label: "21 Days", emoji: "\uD83D\uDCAA", achieved: false },
  { days: 30, label: "1 Month", emoji: "\uD83D\uDD25", achieved: false },
  { days: 60, label: "2 Months", emoji: "\uD83C\uDFC6", achieved: false },
  { days: 90, label: "3 Months", emoji: "\uD83D\uDC51", achieved: false },
  { days: 180, label: "6 Months", emoji: "\uD83D\uDC8E", achieved: false },
  { days: 365, label: "1 Year", emoji: "\uD83C\uDFAF", achieved: false },
]

function getDateKey(d: Date): string {
  return d.toISOString().split("T")[0]
}

function calculateStreak(completionHistory: string[]): number {
  const unique = Array.from(new Set(completionHistory)).sort().reverse()
  const today = getDateKey(new Date())
  const yesterday = getDateKey(new Date(Date.now() - 86400000))

  if (!unique.length || (unique[0] !== today && unique[0] !== yesterday)) return 0

  let streak = 0
  let expected = unique[0]
  for (const date of unique) {
    if (date === expected) {
      streak++
      const d = new Date(expected + "T12:00:00")
      d.setDate(d.getDate() - 1)
      expected = getDateKey(d)
    } else {
      break
    }
  }
  return streak
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HabitTrackerWidget({ widget, onUpdate, progress, onComplete }: HabitTrackerWidgetProps) {
  const data = widget.habitTrackerData
  const today = getDateKey(new Date())

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  // All hooks must be called before any early return
  const completionSet = useMemo(
    () => new Set(data?.completionHistory || []),
    [data?.completionHistory]
  )

  const last7Days = useMemo(() => {
    const days: { key: string; label: string; completed: boolean }[] = []
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const key = getDateKey(d)
      days.push({
        key,
        label: dayLabels[d.getDay()],
        completed: completionSet.has(key),
      })
    }
    return days
  }, [completionSet])

  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)
    const cells: { day: number | null; key: string; completed: boolean }[] = []

    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: null, key: `empty-${i}`, completed: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      cells.push({ day: d, key, completed: completionSet.has(key) })
    }
    return cells
  }, [calendarMonth, completionSet])

  if (!data || !data.habitName) {
    return (
      <div className="mt-6 text-center text-sm text-theme-text-tertiary py-12">
        <Target className="h-10 w-10 mx-auto mb-3 text-theme-neutral-300" />
        <p>No habit configured yet.</p>
        <p className="text-xs mt-1">Close this panel and click the widget to configure it.</p>
      </div>
    )
  }

  const isCompletedToday = completionSet.has(today)
  const currentStreak = calculateStreak(data.completionHistory || [])
  const bestStreak = Math.max(data.bestStreak || 0, currentStreak)

  // Stats
  const startDate = data.startDate || today
  const daysSinceStart = Math.max(
    1,
    Math.floor((new Date().getTime() - new Date(startDate + "T00:00:00").getTime()) / 86400000) + 1
  )
  const completionRate = Math.round(((data.totalCompletions || 0) / daysSinceStart) * 100)

  // Milestones with live check
  const milestones = (data.milestones || DEFAULT_MILESTONES).map((m) => ({
    ...m,
    achieved: m.achieved || currentStreak >= m.days,
  }))

  const monthLabel = new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  const isCurrentMonth =
    calendarMonth.year === new Date().getFullYear() &&
    calendarMonth.month === new Date().getMonth()

  // Toggle completion for today
  function handleToggleToday() {
    if (!data) return
    const history = [...(data.completionHistory || [])]
    let totalCompletions = data.totalCompletions || 0

    if (isCompletedToday) {
      // Undo: remove today
      const idx = history.lastIndexOf(today)
      if (idx !== -1) history.splice(idx, 1)
      totalCompletions = Math.max(0, totalCompletions - 1)
    } else {
      // Complete today
      history.push(today)
      totalCompletions++
      onComplete()
    }

    const newStreak = calculateStreak(history)
    const newBestStreak = Math.max(data.bestStreak || 0, newStreak)

    // Check milestones
    const updatedMilestones = (data.milestones || DEFAULT_MILESTONES).map((m) => {
      if (!m.achieved && newStreak >= m.days) {
        return { ...m, achieved: true, achievedDate: today }
      }
      return m
    })

    onUpdate({
      habitTrackerData: {
        ...data,
        completionHistory: history,
        totalCompletions,
        bestStreak: newBestStreak,
        milestones: updatedMilestones,
      },
    })
  }

  function navigateMonth(delta: number) {
    setCalendarMonth((prev) => {
      let m = prev.month + delta
      let y = prev.year
      if (m < 0) { m = 11; y-- }
      if (m > 11) { m = 0; y++ }
      return { year: y, month: m }
    })
  }

  return (
    <div className="mt-4 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <Target className="h-5 w-5 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-theme-text-primary truncate">{data.habitName}</h3>
          {data.habitDescription && (
            <p className="text-xs text-theme-text-tertiary mt-0.5 line-clamp-2">{data.habitDescription}</p>
          )}
          <p className="text-xs text-theme-neutral-400 mt-0.5">
            Tracking since {new Date(startDate + "T12:00:00").toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Streak + Today's Check-In */}
      <div className="rounded-xl border border-theme-neutral-300 bg-theme-surface-alt p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-theme-text-primary">{currentStreak}</span>
              <span className="text-sm font-medium text-theme-text-tertiary">day streak</span>
              {currentStreak > 0 && <Flame className="h-5 w-5 text-orange-500" />}
            </div>
            {bestStreak > currentStreak && (
              <p className="text-xs text-theme-neutral-400 mt-0.5">
                Best: {bestStreak} days
              </p>
            )}
          </div>
          <Button
            onClick={handleToggleToday}
            variant={isCompletedToday ? "default" : "outline"}
            className={
              isCompletedToday
                ? "bg-green-600 hover:bg-green-700 text-white gap-1.5"
                : "border-theme-neutral-300 text-theme-text-subtle hover:bg-green-50 hover:text-theme-text-primary hover:border-green-300 gap-1.5"
            }
          >
            <Check className="h-4 w-4" />
            {isCompletedToday ? "Completed" : "Complete Today"}
          </Button>
        </div>
      </div>

      {/* 7-Day Overview */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-2">Last 7 Days</h4>
        <div className="flex gap-2 justify-between">
          {last7Days.map((day) => (
            <div key={day.key} className="flex flex-col items-center gap-1">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  day.completed
                    ? "bg-green-500 text-white"
                    : day.key === today
                      ? "border-2 border-dashed border-theme-neutral-300 text-theme-neutral-400"
                      : "bg-theme-neutral-100 text-theme-neutral-400"
                }`}
              >
                {day.completed ? <Check className="h-4 w-4" /> : null}
              </div>
              <span className={`text-[10px] ${day.key === today ? "font-semibold text-theme-text-primary" : "text-theme-neutral-400"}`}>
                {day.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Heat Map */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Calendar
          </h4>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-1 rounded hover:bg-theme-neutral-100 text-theme-text-tertiary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-theme-text-subtle min-w-[120px] text-center">
              {monthLabel}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              disabled={isCurrentMonth}
              className="p-1 rounded hover:bg-theme-neutral-100 text-theme-text-tertiary transition-colors disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-center text-[10px] font-medium text-theme-neutral-400 pb-1">
              {d}
            </div>
          ))}
          {calendarDays.map((cell) => (
            <div
              key={cell.key}
              className={`aspect-square rounded-md flex items-center justify-center text-xs transition-colors ${
                cell.day === null
                  ? ""
                  : cell.completed
                    ? "bg-green-500 text-white font-medium"
                    : cell.key === today
                      ? "border border-dashed border-theme-neutral-400 text-theme-text-subtle"
                      : cell.key < today && cell.key >= startDate
                        ? "bg-[#f5f1ec] text-theme-neutral-400"
                        : "text-[#ccc7c0]"
              }`}
            >
              {cell.day}
            </div>
          ))}
        </div>
      </div>

      {/* Milestones */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-2 flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5" />
          Milestones
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {milestones.map((m) => {
            const daysRemaining = m.days - currentStreak
            return (
              <div
                key={m.days}
                className={`rounded-lg border p-2.5 text-xs transition-colors ${
                  m.achieved
                    ? "border-green-200 bg-green-50"
                    : "border-theme-neutral-300 bg-white opacity-60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${m.achieved ? "" : "grayscale opacity-40"}`}>
                    {m.emoji}
                  </span>
                  <div className="min-w-0">
                    <div className={`font-medium truncate ${m.achieved ? "text-theme-text-primary" : "text-theme-text-tertiary"}`}>
                      {m.label}
                    </div>
                    <div className="text-[10px] text-theme-neutral-400">
                      {m.achieved
                        ? m.achievedDate
                          ? `Achieved ${new Date(m.achievedDate + "T12:00:00").toLocaleDateString()}`
                          : "Achieved"
                        : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} to go`}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Stats
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">{data.totalCompletions || 0}</div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">Total Days</div>
          </div>
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">{completionRate}%</div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">Completion Rate</div>
          </div>
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">{currentStreak}</div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">Current Streak</div>
          </div>
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">{bestStreak}</div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">Best Streak</div>
          </div>
        </div>
      </div>
    </div>
  )
}
