"use client"

import { useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Heart,
  Plus,
  TrendingUp,
  TrendingDown,
  Flame,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  Moon,
  Sun,
  Activity,
  Minus,
} from "lucide-react"
import type { WidgetInstance } from "@/types/widgets"
import { motion, AnimatePresence } from "framer-motion"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeartRateWidgetProps {
  widget: WidgetInstance
  onUpdate: (updates: Partial<WidgetInstance>) => void
  progress: number | { value: number; streak: number; isToday: boolean }
  onComplete: () => void
}

interface HeartRateEntry {
  date: string
  bpm: number
  context: string
  loggedAt: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTEXTS = [
  { id: "resting", label: "Resting", icon: Minus, color: "text-blue-500" },
  { id: "morning", label: "Morning", icon: Sun, color: "text-amber-500" },
  { id: "evening", label: "Evening", icon: Moon, color: "text-indigo-500" },
  { id: "post-exercise", label: "Post-Exercise", icon: Activity, color: "text-red-500" },
] as const

const QUICK_BPM = [60, 65, 70, 75, 80]

const getDateKey = (d: Date = new Date()) => d.toISOString().split("T")[0]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateStreak(
  entries: HeartRateEntry[]
): { current: number; best: number } {
  const dates = new Set(entries.map((e) => e.date))
  const sortedDates = Array.from(dates).sort().reverse()
  let current = 0
  let best = 0
  let streak = 0
  const today = getDateKey()
  let expectedDate = today

  for (const d of sortedDates) {
    if (d > today) continue
    if (d === expectedDate || (streak === 0 && d <= today)) {
      streak++
      const prev = new Date(d)
      prev.setDate(prev.getDate() - 1)
      expectedDate = getDateKey(prev)
    } else {
      break
    }
  }
  current = streak

  const allDates = Array.from(dates).sort()
  streak = 0
  let prev = ""
  for (const d of allDates) {
    if (prev) {
      const expected = new Date(prev)
      expected.setDate(expected.getDate() + 1)
      if (d === getDateKey(expected)) {
        streak++
      } else {
        streak = 1
      }
    } else {
      streak = 1
    }
    best = Math.max(best, streak)
    prev = d
  }

  return { current, best }
}

function getBpmZone(bpm: number): { label: string; color: string } {
  if (bpm < 60) return { label: "Low", color: "text-theme-text-primary" }
  if (bpm <= 80) return { label: "Normal", color: "text-theme-text-primary" }
  if (bpm <= 100) return { label: "Elevated", color: "text-theme-text-primary" }
  return { label: "High", color: "text-theme-text-primary" }
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function HeartBeatVisualization({
  bpm,
  hasReading,
}: {
  bpm: number
  hasReading: boolean
}) {
  const zone = getBpmZone(bpm)
  // Pulsing speed based on BPM
  const duration = hasReading ? 60 / bpm : 1.2

  return (
    <div className="flex flex-col items-center py-3">
      <motion.div
        animate={
          hasReading
            ? { scale: [1, 1.15, 1, 1.08, 1] }
            : { scale: 1 }
        }
        transition={{
          duration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative flex h-28 w-28 items-center justify-center"
      >
        <Heart
          className={`h-24 w-24 ${hasReading ? "fill-red-100 text-red-500" : "fill-gray-100 text-gray-300"}`}
          strokeWidth={1.5}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
          <span
            className={`text-2xl font-bold ${hasReading ? "text-theme-text-primary" : "text-gray-400"}`}
          >
            {hasReading ? bpm : "--"}
          </span>
          <span className="text-2xs text-theme-text-tertiary">BPM</span>
        </div>
      </motion.div>
      {hasReading && (
        <Badge
          variant="secondary"
          className={`mt-2 ${zone.color}`}
        >
          {zone.label}
        </Badge>
      )}
    </div>
  )
}

function HeartRateLineChart({
  entries,
}: {
  entries: HeartRateEntry[]
}) {
  const days = useMemo(() => {
    const result: { label: string; avg: number | null; isToday: boolean }[] = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = getDateKey(d)
      const dayEntries = entries.filter((e) => e.date === key)
      const avg =
        dayEntries.length > 0
          ? Math.round(
              dayEntries.reduce((s, e) => s + e.bpm, 0) / dayEntries.length
            )
          : null
      result.push({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        avg,
        isToday: i === 0,
      })
    }
    return result
  }, [entries])

  const validValues = days.filter((d) => d.avg !== null).map((d) => d.avg!)
  const minBpm = validValues.length > 0 ? Math.min(...validValues) - 10 : 50
  const maxBpm = validValues.length > 0 ? Math.max(...validValues) + 10 : 100
  const range = maxBpm - minBpm || 1

  return (
    <div className="space-y-1.5">
      {days.map((d) => {
        const pct =
          d.avg !== null ? ((d.avg - minBpm) / range) * 100 : 0
        const zone = d.avg !== null ? getBpmZone(d.avg) : null
        return (
          <div key={d.label} className="flex items-center gap-2">
            <span
              className={`w-8 text-right text-xs ${d.isToday ? "font-bold text-theme-text-primary" : "text-theme-text-tertiary"}`}
            >
              {d.label}
            </span>
            <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-gray-100">
              {d.avg !== null && (
                <motion.div
                  className={`h-full rounded-full ${
                    zone?.label === "Normal"
                      ? "bg-green-400"
                      : zone?.label === "Low"
                        ? "bg-blue-400"
                        : zone?.label === "Elevated"
                          ? "bg-amber-400"
                          : "bg-red-400"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(pct, 8)}%` }}
                  transition={{ duration: 0.5 }}
                />
              )}
            </div>
            <span className="w-12 text-right text-xs tabular-nums text-theme-text-secondary">
              {d.avg !== null ? `${d.avg} bpm` : "---"}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HeartRateWidget({
  widget,
  onUpdate,
  progress,
  onComplete,
}: HeartRateWidgetProps) {
  const data = widget.heartRateData ?? {
    entries: [],
    weeklyAverage: 0,
    currentStreak: 0,
    bestStreak: 0,
  }
  const entries = data.entries ?? []

  const [selectedContext, setSelectedContext] = useState("resting")
  const [customBpm, setCustomBpm] = useState("")
  const [showHistory, setShowHistory] = useState(false)

  const today = getDateKey()
  const todayEntries = useMemo(
    () => entries.filter((e) => e.date === today),
    [entries, today]
  )
  const latestToday = todayEntries.length > 0
    ? todayEntries[todayEntries.length - 1]
    : null
  const hasLoggedToday = todayEntries.length > 0

  // ------- Handlers -------

  const handleLogBpm = useCallback(
    (bpm: number) => {
      if (bpm <= 0 || bpm > 300) return
      const now = new Date()
      const newEntry: HeartRateEntry = {
        date: today,
        bpm,
        context: selectedContext,
        loggedAt: now.toISOString(),
      }
      const newEntries = [...entries, newEntry]
      const { current, best } = calculateStreak(newEntries)

      // Weekly average
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 6)
      const weekKey = getDateKey(weekAgo)
      const weekEntries = newEntries.filter((e) => e.date >= weekKey)
      const weeklyAverage =
        weekEntries.length > 0
          ? Math.round(
              weekEntries.reduce((s, e) => s + e.bpm, 0) / weekEntries.length
            )
          : 0

      // Min/max
      const allBpm = newEntries.map((e) => e.bpm)
      const lowestRecorded = Math.min(...allBpm)
      const highestRecorded = Math.max(...allBpm)

      onUpdate({
        heartRateData: {
          entries: newEntries,
          weeklyAverage,
          currentStreak: current,
          bestStreak: Math.max(best, data.bestStreak ?? 0),
          lowestRecorded,
          highestRecorded,
        },
      })

      // First log of the day triggers completion
      if (!hasLoggedToday) {
        onComplete()
      }

      setCustomBpm("")
    },
    [entries, today, selectedContext, hasLoggedToday, data, onUpdate, onComplete]
  )

  const handleDeleteEntry = useCallback(
    (loggedAt: string) => {
      const newEntries = entries.filter((e) => e.loggedAt !== loggedAt)
      const { current, best } = calculateStreak(newEntries)

      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 6)
      const weekKey = getDateKey(weekAgo)
      const weekEntries = newEntries.filter((e) => e.date >= weekKey)
      const weeklyAverage =
        weekEntries.length > 0
          ? Math.round(
              weekEntries.reduce((s, e) => s + e.bpm, 0) / weekEntries.length
            )
          : 0

      const allBpm = newEntries.map((e) => e.bpm)
      const lowestRecorded = allBpm.length > 0 ? Math.min(...allBpm) : undefined
      const highestRecorded = allBpm.length > 0 ? Math.max(...allBpm) : undefined

      onUpdate({
        heartRateData: {
          entries: newEntries,
          weeklyAverage,
          currentStreak: current,
          bestStreak: Math.max(best, data.bestStreak ?? 0),
          lowestRecorded,
          highestRecorded,
        },
      })
    },
    [entries, data, onUpdate]
  )

  // ------- Grouped history -------

  const groupedHistory = useMemo(() => {
    const byDate = new Map<string, HeartRateEntry[]>()
    for (const e of [...entries].sort(
      (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
    )) {
      const arr = byDate.get(e.date) ?? []
      arr.push(e)
      byDate.set(e.date, arr)
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 14)
  }, [entries])

  const getContextIcon = (context: string) => {
    const ctx = CONTEXTS.find((c) => c.id === context)
    if (!ctx) return <Heart className="h-3.5 w-3.5" />
    const Icon = ctx.icon
    return <Icon className={`h-3.5 w-3.5 ${ctx.color}`} />
  }

  const getContextLabel = (context: string) => {
    return CONTEXTS.find((c) => c.id === context)?.label ?? context
  }

  // ------- Render -------

  return (
    <div className="space-y-5 px-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
          <Heart className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h3 className="font-semibold text-theme-text-primary">
            {widget.name || "Heart Rate"}
          </h3>
          <p className="text-sm text-theme-text-tertiary">
            Track your resting heart rate
          </p>
        </div>
      </div>

      {/* Heartbeat visualization */}
      <HeartBeatVisualization
        bpm={latestToday?.bpm ?? 0}
        hasReading={hasLoggedToday}
      />

      {/* Context selector */}
      <div className="flex justify-center gap-2">
        {CONTEXTS.map((ctx) => {
          const Icon = ctx.icon
          const active = selectedContext === ctx.id
          return (
            <button
              key={ctx.id}
              onClick={() => setSelectedContext(ctx.id)}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs transition-all ${
                active
                  ? "bg-red-50 text-theme-text-primary ring-2 ring-red-300"
                  : "bg-gray-50 text-theme-text-secondary hover:bg-gray-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-2xs">{ctx.label}</span>
            </button>
          )
        })}
      </div>

      {/* Quick BPM buttons */}
      <div className="flex items-center gap-2">
        {QUICK_BPM.map((bpm) => (
          <Button
            key={bpm}
            variant="outline"
            size="sm"
            onClick={() => handleLogBpm(bpm)}
            className="flex-1 text-sm font-medium"
          >
            {bpm}
          </Button>
        ))}
      </div>

      {/* Custom BPM input */}
      <div className="flex gap-2">
        <input
          type="number"
          value={customBpm}
          onChange={(e) => setCustomBpm(e.target.value)}
          placeholder="Custom BPM"
          className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm"
          min="30"
          max="300"
        />
        {customBpm && Number(customBpm) > 0 && (
          <Button
            onClick={() => handleLogBpm(Number(customBpm))}
            className="bg-red-500 text-white hover:bg-red-600"
            size="sm"
          >
            <Plus className="mr-1 h-4 w-4" />
            Log
          </Button>
        )}
      </div>

      {/* Today's readings */}
      {todayEntries.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-theme-text-tertiary">
            Today&apos;s Readings
          </p>
          <div className="space-y-1.5">
            {todayEntries.map((e) => {
              const zone = getBpmZone(e.bpm)
              return (
                <div
                  key={e.loggedAt}
                  className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    {getContextIcon(e.context)}
                    <span className="text-sm font-semibold text-theme-text-primary">
                      {e.bpm} bpm
                    </span>
                    <Badge variant="secondary" className="text-2xs">
                      {getContextLabel(e.context)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-theme-text-tertiary">
                      {new Date(e.loggedAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      onClick={() => handleDeleteEntry(e.loggedAt)}
                      className="text-gray-300 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 7-day chart */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-theme-text-tertiary">
          Last 7 Days (Avg)
        </h4>
        <HeartRateLineChart entries={entries} />
      </div>

      {/* Stats grid */}
      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-theme-text-tertiary">
          <TrendingUp className="h-3.5 w-3.5" /> Stats
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-xl font-bold text-theme-text-primary">
              {latestToday ? latestToday.bpm : "--"}
            </p>
            <p className="text-2xs uppercase tracking-wider text-theme-text-tertiary">
              Latest
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-xl font-bold text-theme-text-primary">
              {data.weeklyAverage || "--"}
            </p>
            <p className="text-2xs uppercase tracking-wider text-theme-text-tertiary">
              Weekly Avg
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendingDown className="h-4 w-4 text-blue-500" />
              <p className="text-xl font-bold text-theme-text-primary">
                {data.lowestRecorded ?? "--"}
              </p>
            </div>
            <p className="text-2xs uppercase tracking-wider text-theme-text-tertiary">
              Lowest
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4 text-red-500" />
              <p className="text-xl font-bold text-theme-text-primary">
                {data.highestRecorded ?? "--"}
              </p>
            </div>
            <p className="text-2xs uppercase tracking-wider text-theme-text-tertiary">
              Highest
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Flame className="h-4 w-4 text-orange-500" />
              <p className="text-xl font-bold text-theme-text-primary">
                {data.currentStreak ?? 0}
              </p>
            </div>
            <p className="text-2xs uppercase tracking-wider text-theme-text-tertiary">
              Current Streak
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Flame className="h-4 w-4 text-yellow-500" />
              <p className="text-xl font-bold text-theme-text-primary">
                {data.bestStreak ?? 0}
              </p>
            </div>
            <p className="text-2xs uppercase tracking-wider text-theme-text-tertiary">
              Best Streak
            </p>
          </div>
        </div>
      </div>

      {/* History */}
      {groupedHistory.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-theme-text-tertiary"
          >
            <Clock className="h-3.5 w-3.5" />
            History ({entries.length} entries)
            {showHistory ? (
              <ChevronUp className="ml-auto h-4 w-4" />
            ) : (
              <ChevronDown className="ml-auto h-4 w-4" />
            )}
          </button>

          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-3">
                  {groupedHistory.map(([date, dayEntries]) => {
                    const dayAvg = Math.round(
                      dayEntries.reduce((s, e) => s + e.bpm, 0) /
                        dayEntries.length
                    )
                    const d = new Date(date + "T12:00:00")
                    return (
                      <div key={date}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium text-theme-text-secondary">
                            {d.toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-xs font-semibold text-theme-text-secondary">
                            avg {dayAvg} bpm
                          </span>
                        </div>
                        <div className="space-y-1">
                          {dayEntries.map((e) => (
                            <div
                              key={e.loggedAt}
                              className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5"
                            >
                              <div className="flex items-center gap-2">
                                {getContextIcon(e.context)}
                                <span className="text-sm font-medium text-theme-text-primary">
                                  {e.bpm} bpm
                                </span>
                                <span className="text-xs text-theme-text-tertiary">
                                  {getContextLabel(e.context)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-theme-text-tertiary">
                                  {new Date(e.loggedAt).toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <button
                                  onClick={() => handleDeleteEntry(e.loggedAt)}
                                  className="text-gray-300 hover:text-red-400"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
