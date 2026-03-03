"use client"

import { useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Smile,
  TrendingUp,
  Flame,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { WidgetInstance } from "@/types/widgets"
import { motion, AnimatePresence } from "framer-motion"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MoodTrackerWidgetProps {
  widget: WidgetInstance
  onUpdate: (updates: Partial<WidgetInstance>) => void
  progress: { value: number; streak: number; isToday: boolean }
  onComplete: () => void
}

interface MoodEntry {
  date: string
  mood: number
  note?: string
  loggedAt: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOOD_OPTIONS = [
  { value: 1, emoji: "\uD83D\uDE22", label: "Awful", color: "#ef4444", bgClass: "bg-red-100" },
  { value: 2, emoji: "\uD83D\uDE15", label: "Bad", color: "#f97316", bgClass: "bg-orange-100" },
  { value: 3, emoji: "\uD83D\uDE10", label: "Okay", color: "#eab308", bgClass: "bg-yellow-100" },
  { value: 4, emoji: "\uD83D\uDE0A", label: "Good", color: "#22c55e", bgClass: "bg-emerald-100" },
  { value: 5, emoji: "\uD83D\uDE01", label: "Great", color: "#10b981", bgClass: "bg-emerald-100" },
] as const

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateKey(d: Date): string {
  return d.toISOString().split("T")[0]
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

function getMoodOption(value: number) {
  return MOOD_OPTIONS.find((m) => m.value === value) || MOOD_OPTIONS[2]
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function MoodBarChart({
  days,
}: {
  days: Array<{ date: string; label: string; mood: number | null }>
}) {
  return (
    <div className="space-y-1.5">
      {days.map((day, i) => {
        const moodOpt = day.mood != null ? getMoodOption(day.mood) : null
        const pct = day.mood != null ? (day.mood / 5) * 100 : 0
        const isToday = day.date === getDateKey(new Date())

        return (
          <div key={day.date} className="flex items-center gap-2">
            <span
              className={`w-8 text-xs text-right ${
                isToday
                  ? "font-semibold text-theme-text-primary"
                  : "text-theme-text-tertiary"
              }`}
            >
              {day.label}
            </span>
            <div className="flex-1 h-5 bg-theme-neutral-100 rounded-full overflow-hidden">
              {day.mood != null && (
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: moodOpt?.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.06 }}
                />
              )}
            </div>
            <span className="w-8 text-center text-sm">
              {moodOpt ? moodOpt.emoji : "---"}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function MoodDistribution({
  entries,
}: {
  entries: MoodEntry[]
}) {
  const dist = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]
    for (const e of entries) {
      if (e.mood >= 1 && e.mood <= 5) counts[e.mood - 1]++
    }
    const total = entries.length || 1
    return MOOD_OPTIONS.map((opt, i) => ({
      ...opt,
      count: counts[i],
      pct: Math.round((counts[i] / total) * 100),
    }))
  }, [entries])

  if (!entries.length) return null

  return (
    <div className="space-y-1.5">
      {dist.map((item) => (
        <div key={item.value} className="flex items-center gap-2">
          <span className="text-sm w-6 text-center">{item.emoji}</span>
          <div className="flex-1 h-4 bg-theme-neutral-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: item.color }}
              initial={{ width: 0 }}
              animate={{ width: `${item.pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <span className="w-10 text-xs text-right tabular-nums text-theme-text-secondary">
            {item.pct}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MoodTrackerWidget({
  widget,
  onUpdate,
  onComplete,
}: MoodTrackerWidgetProps) {
  const entries = useMemo(
    () => widget.moodData?.entries || [],
    [widget.moodData?.entries]
  )
  const today = getDateKey(new Date())

  // Form state
  const [selectedMood, setSelectedMood] = useState<number | null>(null)
  const [note, setNote] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const [showDistribution, setShowDistribution] = useState(false)

  // Derived data
  const todayEntry = useMemo(
    () => entries.find((e) => e.date === today),
    [entries, today]
  )

  const last7Days = useMemo(() => {
    const days: Array<{ date: string; label: string; mood: number | null }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const key = getDateKey(d)
      const entry = entries.find((e) => e.date === key)
      days.push({
        date: key,
        label: DAY_LABELS[d.getDay()],
        mood: entry?.mood ?? null,
      })
    }
    return days
  }, [entries])

  const weeklyAverage = useMemo(() => {
    const logged = last7Days.filter((d) => d.mood != null)
    if (!logged.length) return 0
    return Number(
      (logged.reduce((s, d) => s + (d.mood ?? 0), 0) / logged.length).toFixed(1)
    )
  }, [last7Days])

  const currentStreak = useMemo(() => calculateStreak(entries), [entries])
  const bestStreak = Math.max(widget.moodData?.bestStreak || 0, currentStreak)

  // Get the average mood option for display
  const avgMoodOpt = weeklyAverage > 0 ? getMoodOption(Math.round(weeklyAverage)) : null

  // Handler: log mood
  const handleLogMood = useCallback(
    (mood: number) => {
      const newEntry: MoodEntry = {
        date: today,
        mood,
        note: note.trim() || undefined,
        loggedAt: new Date().toISOString(),
      }
      // Replace today's entry if exists, otherwise add
      const updatedEntries = entries.filter((e) => e.date !== today)
      updatedEntries.push(newEntry)
      updatedEntries.sort((a, b) => a.date.localeCompare(b.date))

      const newStreak = calculateStreak(updatedEntries)
      const moodOpt = getMoodOption(mood)

      onUpdate({
        moodData: {
          currentMood: mood,
          moodNote: note.trim() || undefined,
          lastUpdated: new Date().toISOString(),
          entries: updatedEntries,
          weeklyAverage,
          currentStreak: newStreak,
          bestStreak: Math.max(bestStreak, newStreak),
        },
      })

      if (!todayEntry) {
        onComplete()
      }

      setSelectedMood(null)
      setNote("")
    },
    [today, note, entries, weeklyAverage, bestStreak, todayEntry, onUpdate, onComplete]
  )

  const handleDeleteEntry = useCallback(
    (date: string) => {
      const updatedEntries = entries.filter((e) => e.date !== date)
      const newStreak = calculateStreak(updatedEntries)
      const lastEntry = updatedEntries.length
        ? updatedEntries[updatedEntries.length - 1]
        : null

      onUpdate({
        moodData: {
          currentMood: lastEntry?.mood,
          moodNote: lastEntry?.note,
          lastUpdated: lastEntry?.loggedAt,
          entries: updatedEntries,
          weeklyAverage: widget.moodData?.weeklyAverage ?? 0,
          currentStreak: newStreak,
          bestStreak: Math.max(widget.moodData?.bestStreak || 0, newStreak),
        },
      })
    },
    [entries, widget.moodData, onUpdate]
  )

  return (
    <div className="mt-4 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
          <Smile className="h-5 w-5 text-teal-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-theme-text-primary">
            Mood Tracker
          </h3>
          <p className="text-xs text-theme-text-tertiary mt-0.5">
            Log how you feel each day
          </p>
        </div>
        {currentStreak >= 2 && (
          <Badge variant="secondary" className="gap-1">
            <Flame className="h-3 w-3 text-orange-500" />
            {currentStreak} days
          </Badge>
        )}
      </div>

      {/* Today's Mood / Mood Selector */}
      <div className="rounded-2xl bg-gradient-to-b from-teal-50 to-emerald-50 p-6">
        {todayEntry ? (
          <div className="text-center">
            <motion.div
              key={todayEntry.mood}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-6xl mb-2"
            >
              {getMoodOption(todayEntry.mood).emoji}
            </motion.div>
            <div className="text-lg font-semibold text-theme-text-primary">
              {getMoodOption(todayEntry.mood).label}
            </div>
            <div className="text-xs text-theme-text-tertiary mt-1">
              Logged at{" "}
              {new Date(todayEntry.loggedAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
            {todayEntry.note && (
              <div className="text-sm text-theme-text-secondary mt-2 italic">
                &quot;{todayEntry.note}&quot;
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedMood(todayEntry.mood)}
              className="mt-3 text-xs"
            >
              Update mood
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-sm font-medium text-theme-text-secondary mb-4">
              How are you feeling?
            </div>
            <div className="flex justify-center gap-3">
              {MOOD_OPTIONS.map((opt) => (
                <motion.button
                  key={opt.value}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedMood(opt.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-colors ${
                    selectedMood === opt.value
                      ? `${opt.bgClass} ring-2 ring-offset-1`
                      : "hover:bg-white/60"
                  }`}
                  style={
                    selectedMood === opt.value
                      ? { '--tw-ring-color': opt.color } as React.CSSProperties
                      : undefined
                  }
                >
                  <span className="text-3xl">{opt.emoji}</span>
                  <span className="text-[10px] font-medium text-theme-text-secondary">
                    {opt.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mood Entry Form (shown when selecting/updating mood) */}
      <AnimatePresence>
        {selectedMood !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-theme-neutral-300 bg-white p-4 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {getMoodOption(selectedMood).emoji}
                </span>
                <div>
                  <div className="text-sm font-semibold text-theme-text-primary">
                    {getMoodOption(selectedMood).label}
                  </div>
                  <div className="text-xs text-theme-text-tertiary">
                    Tap another emoji above to change
                  </div>
                </div>
              </div>

              {/* Quick mood selector for updating */}
              <div className="flex justify-center gap-2">
                {MOOD_OPTIONS.map((opt) => (
                  <motion.button
                    key={opt.value}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedMood(opt.value)}
                    className={`rounded-lg p-1.5 text-xl transition-all ${
                      selectedMood === opt.value
                        ? `${opt.bgClass} shadow-sm scale-110`
                        : "opacity-40 hover:opacity-70"
                    }`}
                  >
                    {opt.emoji}
                  </motion.button>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-theme-text-secondary block mb-1">
                  What&apos;s on your mind? (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note about how you're feeling..."
                  rows={2}
                  className="w-full rounded-lg border border-theme-neutral-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleLogMood(selectedMood)}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {todayEntry ? "Update Mood" : "Log Mood"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedMood(null)
                    setNote("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7-Day Mood Chart */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-3">
          Last 7 Days
        </h4>
        <MoodBarChart days={last7Days} />
      </div>

      {/* Stats Grid */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Stats
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">
              {todayEntry ? (
                <span className="text-2xl">{getMoodOption(todayEntry.mood).emoji}</span>
              ) : (
                "---"
              )}
            </div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">
              Today
            </div>
          </div>
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">
              {avgMoodOpt ? (
                <span>
                  {weeklyAverage}{" "}
                  <span className="text-lg">{avgMoodOpt.emoji}</span>
                </span>
              ) : (
                "---"
              )}
            </div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">
              Weekly Avg
            </div>
          </div>
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">
              {currentStreak}
            </div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">
              Current Streak
            </div>
          </div>
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">
              {bestStreak}
            </div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">
              Best Streak
            </div>
          </div>
        </div>
      </div>

      {/* Mood Distribution */}
      {entries.length >= 3 && (
        <div>
          <button
            onClick={() => setShowDistribution(!showDistribution)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary hover:text-theme-text-secondary transition-colors w-full"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Mood Distribution
            {showDistribution ? (
              <ChevronUp className="h-3.5 w-3.5 ml-auto" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 ml-auto" />
            )}
          </button>
          <AnimatePresence>
            {showDistribution && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2">
                  <MoodDistribution entries={entries} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* History */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary hover:text-theme-text-secondary transition-colors w-full"
        >
          <Clock className="h-3.5 w-3.5" />
          History ({entries.length} entries)
          {showHistory ? (
            <ChevronUp className="h-3.5 w-3.5 ml-auto" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 ml-auto" />
          )}
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
                    No entries yet. Log your first mood!
                  </p>
                ) : (
                  [...entries]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 14)
                    .map((entry) => {
                      const moodOpt = getMoodOption(entry.mood)
                      return (
                        <div
                          key={entry.date}
                          className="flex items-center gap-3 rounded-lg border border-theme-neutral-200 bg-white p-2.5 text-xs"
                        >
                          <span className="text-lg">{moodOpt.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-theme-text-primary">
                                {new Date(
                                  entry.date + "T12:00:00"
                                ).toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                              <span className="font-semibold text-theme-text-primary">
                                {moodOpt.label}
                              </span>
                            </div>
                            {entry.note && (
                              <div className="text-theme-text-tertiary mt-0.5 truncate">
                                {entry.note}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteEntry(entry.date)}
                            className="p-1 rounded hover:bg-red-50 text-theme-neutral-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
