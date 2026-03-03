"use client"

import { useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Target,
  Plus,
  TrendingUp,
  Flame,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  Footprints,
  Mountain,
  Activity,
} from "lucide-react"
import type { WidgetInstance } from "@/types/widgets"
import { motion, AnimatePresence } from "framer-motion"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepsTrackerWidgetProps {
  widget: WidgetInstance
  onUpdate: (updates: Partial<WidgetInstance>) => void
  progress: number | { value: number; streak: number; isToday: boolean }
  onComplete: () => void
}

interface StepsEntry {
  date: string
  steps: number
  source: string
  loggedAt: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVITY_TYPES = [
  { id: "walk", label: "Walk", icon: Footprints },
  { id: "run", label: "Run", icon: Activity },
  { id: "hike", label: "Hike", icon: Mountain },
  { id: "manual", label: "Manual", icon: Plus },
] as const

const QUICK_ADD_PRESETS = [
  { label: "1,000", value: 1000 },
  { label: "2,500", value: 2500 },
  { label: "5,000", value: 5000 },
  { label: "Custom", value: 0 },
]

const getDateKey = (d: Date = new Date()) => d.toISOString().split("T")[0]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateStreak(
  entries: StepsEntry[],
  target: number
): { current: number; best: number } {
  const byDate = new Map<string, number>()
  for (const e of entries) {
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.steps)
  }
  const sortedDates = Array.from(byDate.keys()).sort().reverse()
  let current = 0
  let best = 0
  let streak = 0
  const today = getDateKey()
  let expectedDate = today

  for (const d of sortedDates) {
    if (d > today) continue
    const total = byDate.get(d) ?? 0
    if (total < target) {
      if (d === today) continue // today not yet reached is okay
      break
    }
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

  // Calculate best streak
  const allDates = Array.from(byDate.keys()).sort()
  streak = 0
  for (const d of allDates) {
    if ((byDate.get(d) ?? 0) >= target) {
      streak++
      best = Math.max(best, streak)
    } else {
      streak = 0
    }
  }

  return { current, best }
}

function formatSteps(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k"
  return String(n)
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function StepsRingVisualization({
  current,
  target,
}: {
  current: number
  target: number
}) {
  const pct = Math.min(current / target, 1)
  const goalMet = current >= target
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - pct)

  return (
    <div className="flex flex-col items-center py-3">
      <div className="relative" style={{ width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          {/* Background ring */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
          />
          {/* Progress ring */}
          <motion.circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={goalMet ? "#22c55e" : "#3b82f6"}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            transform="rotate(-90 70 70)"
          />
          {goalMet && (
            <motion.text
              x="70"
              y="50"
              textAnchor="middle"
              fontSize="24"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              🎉
            </motion.text>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`text-2xl font-bold ${goalMet ? "text-green-600" : "text-blue-600"}`}
          >
            {current.toLocaleString()}
          </span>
          <span className="text-xs text-theme-text-tertiary">
            / {target.toLocaleString()}
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm text-theme-text-secondary">
        {goalMet
          ? "Goal reached! 🎉"
          : `${(target - current).toLocaleString()} steps to go`}
      </p>
    </div>
  )
}

function StepsBarChart({
  entries,
  target,
}: {
  entries: StepsEntry[]
  target: number
}) {
  const days = useMemo(() => {
    const result: { label: string; total: number; isToday: boolean }[] = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = getDateKey(d)
      const dayEntries = entries.filter((e) => e.date === key)
      const total = dayEntries.reduce((s, e) => s + e.steps, 0)
      result.push({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        total,
        isToday: i === 0,
      })
    }
    return result
  }, [entries])

  const maxVal = Math.max(target, ...days.map((d) => d.total), 1)

  return (
    <div className="space-y-1.5">
      {days.map((d) => {
        const pct = Math.min((d.total / maxVal) * 100, 100)
        const metGoal = d.total >= target
        return (
          <div key={d.label} className="flex items-center gap-2">
            <span
              className={`w-8 text-right text-xs ${d.isToday ? "font-bold text-theme-text-primary" : "text-theme-text-tertiary"}`}
            >
              {d.label}
            </span>
            <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-gray-100">
              {target > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-gray-300"
                  style={{ left: `${(target / maxVal) * 100}%` }}
                />
              )}
              <motion.div
                className={`h-full rounded-full ${
                  metGoal
                    ? "bg-green-400"
                    : d.total > 0
                      ? "bg-blue-400"
                      : "bg-transparent"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="w-10 text-right text-xs tabular-nums text-theme-text-secondary">
              {d.total > 0 ? formatSteps(d.total) : "---"}
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

export function StepsTrackerWidget({
  widget,
  onUpdate,
  progress,
  onComplete,
}: StepsTrackerWidgetProps) {
  const target = widget.target || 10000
  const data = widget.stepsData ?? {
    entries: [],
    weeklyAverage: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalSteps: 0,
  }
  const entries = data.entries ?? []

  const [selectedActivity, setSelectedActivity] = useState("walk")
  const [customAmount, setCustomAmount] = useState("")
  const [showHistory, setShowHistory] = useState(false)

  const today = getDateKey()
  const todayEntries = useMemo(
    () => entries.filter((e) => e.date === today),
    [entries, today]
  )
  const todayTotal = useMemo(
    () => todayEntries.reduce((s, e) => s + e.steps, 0),
    [todayEntries]
  )
  const goalAlreadyMet = todayTotal >= target

  // ------- Handlers -------

  const handleLogSteps = useCallback(
    (amount: number) => {
      if (amount <= 0) return
      const now = new Date()
      const newEntry: StepsEntry = {
        date: today,
        steps: amount,
        source: selectedActivity,
        loggedAt: now.toISOString(),
      }
      const newEntries = [...entries, newEntry]
      const newTodayTotal = todayTotal + amount
      const { current, best } = calculateStreak(newEntries, target)

      // Weekly average
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 6)
      const weekKey = getDateKey(weekAgo)
      const weekEntries = newEntries.filter((e) => e.date >= weekKey)
      const weekByDate = new Map<string, number>()
      for (const e of weekEntries) {
        weekByDate.set(e.date, (weekByDate.get(e.date) ?? 0) + e.steps)
      }
      const weeklyAverage = weekByDate.size > 0
        ? Math.round(Array.from(weekByDate.values()).reduce((a, b) => a + b, 0) / weekByDate.size)
        : 0

      const totalSteps = (data.totalSteps ?? 0) + amount

      onUpdate({
        stepsData: {
          entries: newEntries,
          weeklyAverage,
          currentStreak: current,
          bestStreak: Math.max(best, data.bestStreak ?? 0),
          totalSteps,
        },
      })

      // Trigger completion when goal first met
      if (!goalAlreadyMet && newTodayTotal >= target) {
        onComplete()
      }

      setCustomAmount("")
    },
    [
      entries,
      today,
      todayTotal,
      target,
      selectedActivity,
      goalAlreadyMet,
      data,
      onUpdate,
      onComplete,
    ]
  )

  const handleDeleteEntry = useCallback(
    (loggedAt: string) => {
      const newEntries = entries.filter((e) => e.loggedAt !== loggedAt)
      const deleted = entries.find((e) => e.loggedAt === loggedAt)
      const { current, best } = calculateStreak(newEntries, target)

      // Recalculate weekly average
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 6)
      const weekKey = getDateKey(weekAgo)
      const weekEntries = newEntries.filter((e) => e.date >= weekKey)
      const weekByDate = new Map<string, number>()
      for (const e of weekEntries) {
        weekByDate.set(e.date, (weekByDate.get(e.date) ?? 0) + e.steps)
      }
      const weeklyAverage = weekByDate.size > 0
        ? Math.round(Array.from(weekByDate.values()).reduce((a, b) => a + b, 0) / weekByDate.size)
        : 0

      const totalSteps = Math.max(0, (data.totalSteps ?? 0) - (deleted?.steps ?? 0))

      onUpdate({
        stepsData: {
          entries: newEntries,
          weeklyAverage,
          currentStreak: current,
          bestStreak: Math.max(best, data.bestStreak ?? 0),
          totalSteps,
        },
      })
    },
    [entries, target, data, onUpdate]
  )

  // ------- Grouped history -------

  const groupedHistory = useMemo(() => {
    const byDate = new Map<string, StepsEntry[]>()
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

  const getActivityIcon = (source: string) => {
    const type = ACTIVITY_TYPES.find((t) => t.id === source)
    if (!type) return <Footprints className="h-3.5 w-3.5" />
    const Icon = type.icon
    return <Icon className="h-3.5 w-3.5" />
  }

  const getActivityLabel = (source: string) => {
    return ACTIVITY_TYPES.find((t) => t.id === source)?.label ?? source
  }

  // ------- Render -------

  return (
    <div className="space-y-5 px-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
          <Footprints className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-theme-text-primary">
            {widget.name || "Daily Steps"}
          </h3>
          <p className="text-sm text-theme-text-tertiary">
            Track your daily step count
          </p>
        </div>
      </div>

      {/* Ring visualization */}
      <StepsRingVisualization current={todayTotal} target={target} />

      {/* Activity type selector */}
      <div className="flex justify-center gap-2">
        {ACTIVITY_TYPES.map((type) => {
          const Icon = type.icon
          const active = selectedActivity === type.id
          return (
            <button
              key={type.id}
              onClick={() => setSelectedActivity(type.id)}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs transition-all ${
                active
                  ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300"
                  : "bg-gray-50 text-theme-text-secondary hover:bg-gray-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {type.label}
            </button>
          )
        })}
      </div>

      {/* Quick-add buttons */}
      <div className="grid grid-cols-4 gap-2">
        {QUICK_ADD_PRESETS.map((preset) =>
          preset.value > 0 ? (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => handleLogSteps(preset.value)}
              className="text-sm font-medium"
            >
              +{preset.label}
            </Button>
          ) : (
            <div key="custom" className="flex gap-1">
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Custom"
                className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                min="1"
                max="99999"
              />
            </div>
          )
        )}
      </div>

      {customAmount && Number(customAmount) > 0 && (
        <Button
          onClick={() => handleLogSteps(Number(customAmount))}
          className="w-full bg-blue-600 text-white hover:bg-blue-700"
          size="sm"
        >
          <Plus className="mr-1 h-4 w-4" />
          Log {Number(customAmount).toLocaleString()} steps
        </Button>
      )}

      {/* Today's activity log */}
      {todayEntries.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-theme-text-tertiary">
            Today&apos;s Activities
          </p>
          <div className="space-y-1.5">
            {todayEntries.map((e) => (
              <div
                key={e.loggedAt}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-blue-500">
                    {getActivityIcon(e.source)}
                  </span>
                  <span className="text-sm font-medium">
                    {e.steps.toLocaleString()} steps
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {getActivityLabel(e.source)}
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
            ))}
          </div>
        </div>
      )}

      {/* 7-day chart */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-theme-text-tertiary">
          Last 7 Days
        </h4>
        <StepsBarChart entries={entries} target={target} />
      </div>

      {/* Stats grid */}
      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-theme-text-tertiary">
          <TrendingUp className="h-3.5 w-3.5" /> Stats
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-xl font-bold text-blue-600">
              {todayTotal.toLocaleString()}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-theme-text-tertiary">
              Today
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-xl font-bold text-theme-text-primary">
              {(data.weeklyAverage ?? 0).toLocaleString()}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-theme-text-tertiary">
              Weekly Avg
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Flame className="h-4 w-4 text-orange-500" />
              <p className="text-xl font-bold text-theme-text-primary">
                {data.currentStreak ?? 0}
              </p>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-theme-text-tertiary">
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
            <p className="text-[10px] uppercase tracking-wider text-theme-text-tertiary">
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
                    const dayTotal = dayEntries.reduce(
                      (s, e) => s + e.steps,
                      0
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
                          <span
                            className={`text-xs font-semibold ${dayTotal >= target ? "text-green-600" : "text-theme-text-secondary"}`}
                          >
                            {dayTotal.toLocaleString()} steps
                          </span>
                        </div>
                        <div className="space-y-1">
                          {dayEntries.map((e) => (
                            <div
                              key={e.loggedAt}
                              className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-blue-400">
                                  {getActivityIcon(e.source)}
                                </span>
                                <span className="text-sm">
                                  {e.steps.toLocaleString()}
                                </span>
                                <span className="text-xs text-theme-text-tertiary">
                                  {getActivityLabel(e.source)}
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
