"use client"

import { useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Moon,
  Star,
  Clock,
  TrendingUp,
  Flame,
  Bed,
  Sun,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { WidgetInstance } from "@/types/widgets"
import { motion, AnimatePresence } from "framer-motion"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SleepTrackerWidgetProps {
  widget: WidgetInstance
  onUpdate: (updates: Partial<WidgetInstance>) => void
  progress: { value: number; streak: number; isToday: boolean }
  onComplete: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateKey(d: Date): string {
  return d.toISOString().split("T")[0]
}

function calculateSleepDuration(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(":").map(Number)
  const [wh, wm] = wakeTime.split(":").map(Number)
  let bedMinutes = bh * 60 + bm
  let wakeMinutes = wh * 60 + wm
  if (wakeMinutes <= bedMinutes) wakeMinutes += 24 * 60 // overnight
  return Number(((wakeMinutes - bedMinutes) / 60).toFixed(1))
}

function calculateStreak(entries: Array<{ date: string }>): number {
  if (!entries.length) return 0
  const dates = Array.from(new Set(entries.map((e) => e.date))).sort().reverse()
  const today = getDateKey(new Date())
  const yesterday = getDateKey(new Date(Date.now() - 86400000))

  if (dates[0] !== today && dates[0] !== yesterday) return 0

  let streak = 0
  let expected = dates[0]
  for (const date of dates) {
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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function QualityStars({
  value,
  onChange,
  size = "md",
}: {
  value: number
  onChange?: (v: number) => void
  size?: "sm" | "md"
}) {
  const starSize = size === "sm" ? "h-4 w-4" : "h-6 w-6"
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.button
          key={i}
          type="button"
          whileTap={onChange ? { scale: 0.85 } : undefined}
          onClick={() => onChange?.(i)}
          className={onChange ? "cursor-pointer" : "cursor-default"}
          disabled={!onChange}
        >
          <Star
            className={`${starSize} transition-colors ${
              i <= value
                ? "fill-amber-400 text-amber-400"
                : "fill-none text-theme-neutral-300"
            }`}
          />
        </motion.button>
      ))}
    </div>
  )
}

function SleepBarChart({
  days,
  target,
}: {
  days: Array<{ date: string; label: string; duration: number | null; quality: number }>
  target: number
}) {
  const maxVal = Math.max(target, ...days.map((d) => d.duration ?? 0), 1)

  return (
    <div className="space-y-1.5">
      {days.map((day, i) => {
        const pct = day.duration != null ? (day.duration / maxVal) * 100 : 0
        const color =
          day.duration == null
            ? "bg-theme-neutral-200"
            : day.duration >= target
              ? "bg-emerald-500"
              : day.duration >= 6
                ? "bg-amber-400"
                : "bg-red-400"
        const isToday = day.date === getDateKey(new Date())

        return (
          <div key={day.date} className="flex items-center gap-2">
            <span
              className={`w-8 text-xs text-right ${
                isToday ? "font-semibold text-theme-text-primary" : "text-theme-text-tertiary"
              }`}
            >
              {day.label}
            </span>
            <div className="flex-1 h-5 bg-theme-neutral-100 rounded-full overflow-hidden relative">
              <motion.div
                className={`h-full rounded-full ${color}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.06 }}
              />
              {/* Target line */}
              <div
                className="absolute top-0 h-full w-px bg-theme-text-tertiary/30"
                style={{ left: `${(target / maxVal) * 100}%` }}
              />
            </div>
            <span className="w-10 text-xs text-right tabular-nums text-theme-text-secondary">
              {day.duration != null ? `${day.duration}h` : "---"}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SleepTrackerWidget({ widget, onUpdate, onComplete }: SleepTrackerWidgetProps) {
  const target = widget.target || 8
  const entries = useMemo(() => widget.sleepData?.entries || [], [widget.sleepData?.entries])
  const today = getDateKey(new Date())

  // Form state
  const [bedtime, setBedtime] = useState("23:00")
  const [wakeTime, setWakeTime] = useState("07:00")
  const [quality, setQuality] = useState(3)
  const [notes, setNotes] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Derived data
  const todayEntry = useMemo(() => entries.find((e) => e.date === today), [entries, today])

  const last7Days = useMemo(() => {
    const days: Array<{ date: string; label: string; duration: number | null; quality: number }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const key = getDateKey(d)
      const entry = entries.find((e) => e.date === key)
      days.push({
        date: key,
        label: DAY_LABELS[d.getDay()],
        duration: entry?.duration ?? null,
        quality: entry?.quality ?? 0,
      })
    }
    return days
  }, [entries])

  const weeklyAverage = useMemo(() => {
    const logged = last7Days.filter((d) => d.duration != null)
    if (!logged.length) return 0
    return Number((logged.reduce((s, d) => s + (d.duration ?? 0), 0) / logged.length).toFixed(1))
  }, [last7Days])

  const sleepDebt = useMemo(() => {
    const logged = last7Days.filter((d) => d.duration != null)
    if (!logged.length) return 0
    return Number(logged.reduce((s, d) => s + (target - (d.duration ?? 0)), 0).toFixed(1))
  }, [last7Days, target])

  const currentStreak = useMemo(() => calculateStreak(entries), [entries])
  const bestStreak = Math.max(widget.sleepData?.bestStreak || 0, currentStreak)

  const previewDuration = calculateSleepDuration(bedtime, wakeTime)

  // Handlers
  const handleLogSleep = useCallback(() => {
    const duration = calculateSleepDuration(bedtime, wakeTime)
    const newEntry = {
      date: today,
      bedtime,
      wakeTime,
      duration,
      quality,
      notes: notes.trim() || undefined,
    }

    const updatedEntries = entries.filter((e) => e.date !== today)
    updatedEntries.push(newEntry)
    updatedEntries.sort((a, b) => a.date.localeCompare(b.date))

    const newStreak = calculateStreak(updatedEntries)

    onUpdate({
      sleepData: {
        entries: updatedEntries,
        weeklyAverage,
        currentStreak: newStreak,
        bestStreak: Math.max(bestStreak, newStreak),
        sleepDebt,
      },
    })

    if (duration >= target) {
      onComplete()
    }

    setShowForm(false)
    setNotes("")
  }, [bedtime, wakeTime, quality, notes, today, entries, target, weeklyAverage, bestStreak, sleepDebt, onUpdate, onComplete])

  const handleDeleteEntry = useCallback(
    (date: string) => {
      const updatedEntries = entries.filter((e) => e.date !== date)
      const newStreak = calculateStreak(updatedEntries)

      onUpdate({
        sleepData: {
          entries: updatedEntries,
          weeklyAverage: widget.sleepData?.weeklyAverage ?? 0,
          currentStreak: newStreak,
          bestStreak: Math.max(widget.sleepData?.bestStreak || 0, newStreak),
          sleepDebt: widget.sleepData?.sleepDebt ?? 0,
        },
      })
    },
    [entries, widget.sleepData, onUpdate]
  )

  return (
    <div className="mt-4 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
          <Moon className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-theme-text-primary">Sleep Tracker</h3>
          <p className="text-xs text-theme-text-tertiary mt-0.5">
            Target: {target} hours per night
          </p>
        </div>
        {currentStreak >= 2 && (
          <Badge variant="secondary" className="gap-1">
            <Flame className="h-3 w-3 text-orange-500" />
            {currentStreak} days
          </Badge>
        )}
      </div>

      {/* Last Night Summary */}
      <div className="rounded-xl border border-theme-neutral-300 bg-theme-surface-alt p-4">
        {todayEntry ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-theme-text-tertiary mb-1">
                Last Night
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-theme-text-primary">
                  {todayEntry.duration}
                </span>
                <span className="text-sm font-medium text-theme-text-tertiary">hours</span>
                {todayEntry.duration >= target && (
                  <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-700 text-[10px]">
                    Goal met
                  </Badge>
                )}
              </div>
              <div className="mt-1.5">
                <QualityStars value={todayEntry.quality} size="sm" />
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-theme-text-tertiary">
                <span className="flex items-center gap-1">
                  <Bed className="h-3 w-3" /> {todayEntry.bedtime}
                </span>
                <span className="flex items-center gap-1">
                  <Sun className="h-3 w-3" /> {todayEntry.wakeTime}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(!showForm)}
              className="text-xs"
            >
              Edit
            </Button>
          </div>
        ) : (
          <div className="text-center py-2">
            <Moon className="h-8 w-8 mx-auto mb-2 text-indigo-300" />
            <p className="text-sm font-medium text-theme-text-secondary mb-1">
              No sleep logged today
            </p>
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Moon className="h-4 w-4 mr-1.5" />
              Log Last Night
            </Button>
          </div>
        )}
      </div>

      {/* Log Entry Form */}
      <AnimatePresence>
        {(showForm || (!todayEntry && !showForm)) && showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-theme-neutral-300 bg-white p-4 space-y-4">
              <h4 className="text-sm font-semibold text-theme-text-primary">Log Sleep</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-theme-text-secondary block mb-1">
                    <Bed className="h-3 w-3 inline mr-1" />
                    Bedtime
                  </label>
                  <input
                    type="time"
                    value={bedtime}
                    onChange={(e) => setBedtime(e.target.value)}
                    className="w-full rounded-lg border border-theme-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-theme-text-secondary block mb-1">
                    <Sun className="h-3 w-3 inline mr-1" />
                    Wake Time
                  </label>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="w-full rounded-lg border border-theme-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
              </div>

              {/* Duration preview */}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-theme-text-tertiary" />
                <span className="text-theme-text-secondary">Duration:</span>
                <span
                  className={`font-semibold ${
                    previewDuration >= target ? "text-emerald-600" : "text-theme-text-primary"
                  }`}
                >
                  {previewDuration} hours
                </span>
              </div>

              {/* Quality rating */}
              <div>
                <label className="text-xs font-medium text-theme-text-secondary block mb-1.5">
                  Sleep Quality
                </label>
                <QualityStars value={quality} onChange={setQuality} />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-theme-text-secondary block mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How did you sleep?"
                  rows={2}
                  className="w-full rounded-lg border border-theme-neutral-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleLogSleep}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Save Sleep Log
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7-Day Sleep Chart */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-3">
          Last 7 Days
        </h4>
        <SleepBarChart days={last7Days} target={target} />
      </div>

      {/* Stats Grid */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Stats
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">{weeklyAverage}h</div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">
              Weekly Avg
            </div>
          </div>
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div
              className={`text-xl font-bold ${
                sleepDebt > 0 ? "text-red-500" : "text-emerald-600"
              }`}
            >
              {sleepDebt > 0 ? `-${sleepDebt}h` : `+${Math.abs(sleepDebt)}h`}
            </div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">
              Sleep Debt
            </div>
          </div>
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">{currentStreak}</div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">
              Current Streak
            </div>
          </div>
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">{bestStreak}</div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">
              Best Streak
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary hover:text-theme-text-secondary transition-colors w-full"
        >
          <Clock className="h-3.5 w-3.5" />
          History ({entries.length} entries)
          {showHistory ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2">
                {entries.length === 0 ? (
                  <p className="text-xs text-theme-text-tertiary text-center py-4">
                    No entries yet. Log your first night!
                  </p>
                ) : (
                  [...entries]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 14)
                    .map((entry) => (
                      <div
                        key={entry.date}
                        className="flex items-center gap-3 rounded-lg border border-theme-neutral-200 bg-white p-2.5 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-theme-text-primary">
                              {new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className="font-semibold text-theme-text-primary">
                              {entry.duration}h
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-theme-text-tertiary">
                            <span>{entry.bedtime} - {entry.wakeTime}</span>
                            <QualityStars value={entry.quality} size="sm" />
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteEntry(entry.date)}
                          className="p-1 rounded hover:bg-red-50 text-theme-neutral-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
