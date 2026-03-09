"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Target,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Flame,
  Award,
  Calendar,
  Settings,
} from "lucide-react"
import type { WidgetInstance } from "@/types/widgets"
import {
  getDateKey,
  calculateStreak,
  getLast7Days,
  buildTogglePayload,
  countScheduledDaysSince,
  DEFAULT_MILESTONES,
} from "@/lib/habit-utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HabitTrackerWidgetProps {
  widget: WidgetInstance
  onUpdate: (updates: Partial<WidgetInstance>) => void
  progress: { value: number; streak: number; isToday: boolean }
  onComplete: () => void
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
  const [showSettings, setShowSettings] = useState(false)

  // All hooks must be called before any early return
  const completionSet = useMemo(
    () => new Set(data?.completionHistory || []),
    [data?.completionHistory]
  )

  const schedule = widget.schedule as boolean[] | undefined

  const last7Days = useMemo(() => {
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    return getLast7Days().map((key) => {
      const d = new Date(key + "T12:00:00")
      const dow = d.getDay()
      const isScheduled = !schedule || schedule.length < 7 || schedule[dow]
      return {
        key,
        label: dayLabels[dow],
        completed: completionSet.has(key),
        isScheduled,
      }
    })
  }, [completionSet, schedule])

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
      // Filter out future-date completions (legacy UTC entries)
      cells.push({ day: d, key, completed: completionSet.has(key) && key <= today })
    }
    return cells
  }, [calendarMonth, completionSet, today])

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
  const currentStreak = calculateStreak(data.completionHistory || [], schedule)
  const bestStreak = Math.max(data.bestStreak || 0, currentStreak)

  // Stats — schedule-aware completion rate
  const startDate = data.startDate || today
  const scheduledDays = countScheduledDaysSince(startDate, schedule)
  const completionRate = Math.round(((data.totalCompletions || 0) / scheduledDays) * 100)

  // Milestones with live check
  const milestones = (data.milestones || DEFAULT_MILESTONES).map((m) => ({
    ...m,
    achieved: m.achieved || currentStreak >= m.days,
  }))
  const achievedCount = milestones.filter((m) => m.achieved).length
  const nextMilestone = milestones.find((m) => !m.achieved)

  const monthLabel = new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  const isCurrentMonth =
    calendarMonth.year === new Date().getFullYear() &&
    calendarMonth.month === new Date().getMonth()

  // Toggle completion for today
  function handleToggleToday() {
    const payload = buildTogglePayload(widget, isCompletedToday)
    if (!payload) return
    if (!isCompletedToday) onComplete()
    onUpdate(payload)
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
    <div className="mt-2 space-y-5">
      {/* Subtitle — description + tracking since */}
      {(data.habitDescription || startDate) && (
        <div className="text-xs text-theme-text-tertiary space-y-0.5">
          {data.habitDescription && <p className="line-clamp-2">{data.habitDescription}</p>}
          <p className="text-theme-neutral-400">
            Tracking since {new Date(startDate + "T12:00:00").toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Streak card — streak + button + inline stats */}
      <div className="rounded-xl border border-theme-neutral-300 bg-theme-surface-alt p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-theme-text-primary">{currentStreak}</span>
            <span className="text-sm font-medium text-theme-text-tertiary">day streak</span>
            {currentStreak > 0 && <Flame className="h-5 w-5 text-orange-500" />}
          </div>
          <Button
            onClick={handleToggleToday}
            variant={isCompletedToday ? "default" : "outline"}
            className={
              isCompletedToday
                ? "bg-theme-secondary hover:bg-theme-secondary/90 text-white gap-1.5"
                : "border-theme-neutral-300 text-theme-text-subtle hover:bg-theme-brand-tint-subtle hover:text-theme-text-primary hover:border-theme-secondary/40 gap-1.5"
            }
          >
            <Check className="h-4 w-4" />
            {isCompletedToday ? "Completed" : "Complete Today"}
          </Button>
        </div>
        {/* Inline stats row */}
        <div className="mt-3 pt-3 border-t border-theme-neutral-300 flex items-center justify-between text-xs text-theme-text-tertiary">
          <div className="text-center flex-1">
            <span className="font-semibold text-theme-text-primary">{bestStreak}</span>
            <span className="ml-1">Best</span>
          </div>
          <div className="w-px h-3 bg-theme-neutral-300" />
          <div className="text-center flex-1">
            <span className="font-semibold text-theme-text-primary">{data.totalCompletions || 0}</span>
            <span className="ml-1">Total</span>
          </div>
          <div className="w-px h-3 bg-theme-neutral-300" />
          <div className="text-center flex-1">
            <span className="font-semibold text-theme-text-primary">{completionRate}%</span>
            <span className="ml-1">Rate</span>
          </div>
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
                    ? "bg-theme-secondary text-white"
                    : !day.isScheduled
                      ? "bg-theme-neutral-200 opacity-40"
                      : day.key === today
                        ? "border-2 border-dashed border-theme-neutral-300 text-theme-neutral-400"
                        : "bg-theme-neutral-100 text-theme-neutral-400"
                }`}
              >
                {day.completed ? <Check className="h-4 w-4" /> : null}
              </div>
              <span className={`text-2xs ${day.key === today ? "font-semibold text-theme-text-primary" : "text-theme-neutral-400"}`}>
                {day.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Heat Map — compact cells */}
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

        <div className="grid grid-cols-7 gap-0.5">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-center text-2xs font-medium text-theme-neutral-400 pb-0.5">
              {d}
            </div>
          ))}
          {calendarDays.map((cell) => (
            <div
              key={cell.key}
              className={`h-7 w-7 mx-auto rounded-md flex items-center justify-center text-2xs transition-colors ${
                cell.day === null
                  ? ""
                  : cell.completed
                    ? "bg-theme-secondary text-white font-medium"
                    : cell.key === today
                      ? "border border-dashed border-theme-neutral-400 text-theme-text-subtle"
                      : cell.key < today && cell.key >= startDate
                        ? "bg-theme-surface-alt text-theme-neutral-400"
                        : "text-theme-neutral-300"
              }`}
              {...(cell.day !== null ? {
                "aria-label": `${new Date(cell.key + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}, ${cell.completed ? "completed" : "not completed"}`,
              } : {})}
            >
              {cell.day}
            </div>
          ))}
        </div>
      </div>

      {/* Compact Milestones */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-2 flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5" />
          Milestones
        </h4>
        <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 flex items-center justify-between">
          {nextMilestone ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg">{nextMilestone.emoji}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-theme-text-primary truncate">
                  Next: {nextMilestone.label}
                </div>
                <div className="text-2xs text-theme-neutral-400">
                  {nextMilestone.days - currentStreak} day{nextMilestone.days - currentStreak !== 1 ? "s" : ""} to go
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <span className="text-sm font-medium text-theme-text-primary">All milestones achieved!</span>
            </div>
          )}
          <span className="text-xs text-theme-text-tertiary whitespace-nowrap ml-3">
            {achievedCount}/{milestones.length} achieved
          </span>
        </div>
      </div>

      {/* Settings */}
      <div>
        <button
          onClick={() => setShowSettings(prev => !prev)}
          className="w-full flex items-center justify-between py-2 text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary hover:text-theme-text-secondary transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSettings ? "rotate-180" : ""}`} />
        </button>
        {showSettings && (
          <div className="space-y-4 pt-1 pb-1">
            {/* Habit Name */}
            <div>
              <label className="block text-[11px] tracking-[0.6px] uppercase text-theme-text-tertiary font-medium mb-1.5">
                Habit Name
              </label>
              <input
                type="text"
                className="w-full border border-theme-neutral-300 rounded-lg px-3 py-2 text-sm text-theme-text-primary placeholder:text-theme-neutral-400 focus:outline-none focus:ring-2 focus:ring-theme-focus/30 focus:border-theme-primary transition-colors"
                value={data.habitName}
                onChange={(e) => {
                  const name = e.target.value
                  onUpdate({
                    habitTrackerData: { ...data, habitName: name },
                    linkedTaskTitle: name || data.habitName,
                  })
                }}
                placeholder="e.g., Read 30 minutes, Meditate, Exercise"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] tracking-[0.6px] uppercase text-theme-text-tertiary font-medium mb-1.5">
                Description
              </label>
              <input
                type="text"
                className="w-full border border-theme-neutral-300 rounded-lg px-3 py-2 text-sm text-theme-text-primary placeholder:text-theme-neutral-400 focus:outline-none focus:ring-2 focus:ring-theme-focus/30 focus:border-theme-primary transition-colors"
                value={data.habitDescription || ""}
                onChange={(e) => {
                  onUpdate({
                    habitTrackerData: { ...data, habitDescription: e.target.value },
                  })
                }}
                placeholder="Optional description"
              />
            </div>

            {/* Tracking Days */}
            <div>
              <label className="block text-[11px] tracking-[0.6px] uppercase text-theme-text-tertiary font-medium mb-2">
                Tracking Days
              </label>
              <div className="flex gap-1.5">
                {["S", "M", "T", "W", "T", "F", "S"].map((label, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const newSchedule = (widget.schedule || [true, true, true, true, true, true, true]).map(
                        (v: boolean, i: number) => i === idx ? !v : v
                      )
                      onUpdate({ schedule: newSchedule })
                    }}
                    className={`h-8 w-8 rounded-full border text-[11px] font-semibold transition-colors ${
                      (widget.schedule || [])[idx]
                        ? "border-theme-primary bg-theme-primary text-white shadow-sm"
                        : "border-theme-neutral-300 bg-white text-theme-text-subtle hover:border-theme-neutral-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Show in Calendar */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[11px] tracking-[0.6px] uppercase text-theme-text-tertiary font-medium">
                Show in Calendar
              </span>
              <input
                type="checkbox"
                checked={widget.showInCalendar !== false}
                onChange={(e) => onUpdate({ showInCalendar: e.target.checked })}
                className="h-5 w-5 rounded border-theme-neutral-300 text-theme-primary focus:ring-theme-primary/40"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
