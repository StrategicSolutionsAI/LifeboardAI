"use client"

import { useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Coffee,
  Plus,
  TrendingUp,
  Flame,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
  CupSoda,
} from "lucide-react"
import type { WidgetInstance } from "@/types/widgets"
import { motion, AnimatePresence } from "framer-motion"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CaffeineTrackerWidgetProps {
  widget: WidgetInstance
  onUpdate: (updates: Partial<WidgetInstance>) => void
  progress: number | { value: number; streak: number; isToday: boolean }
  onComplete: () => void
}

interface CaffeineEntry {
  date: string
  amount: number    // mg
  beverage: string
  cups: number
  loggedAt: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEVERAGES = [
  { id: "coffee", label: "Coffee", icon: "☕", mgPerCup: 95 },
  { id: "espresso", label: "Espresso", icon: "🫘", mgPerCup: 63 },
  { id: "tea", label: "Tea", icon: "🍵", mgPerCup: 47 },
  { id: "energy_drink", label: "Energy", icon: "⚡", mgPerCup: 80 },
  { id: "soda", label: "Soda", icon: "🥤", mgPerCup: 34 },
  { id: "other", label: "Other", icon: "🧋", mgPerCup: 50 },
] as const

const getDateKey = (d: Date = new Date()) => d.toISOString().split("T")[0]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateStreak(
  entries: CaffeineEntry[],
  target: number
): { current: number; best: number } {
  const byDate = new Map<string, number>()
  for (const e of entries) {
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.cups)
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
      if (d === today) continue
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

function isLateCaffeine(loggedAt: string): boolean {
  const hour = new Date(loggedAt).getHours()
  return hour >= 14 // after 2 PM
}

function getBeverageInfo(id: string) {
  return BEVERAGES.find((b) => b.id === id) ?? BEVERAGES[5] // default to "other"
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function CaffeineMeterVisualization({
  todayCups,
  todayMg,
  target,
}: {
  todayCups: number
  todayMg: number
  target: number
}) {
  const pct = Math.min(todayCups / target, 1)
  const goalMet = todayCups >= target
  // FDA recommends max ~400mg caffeine per day
  const overLimit = todayMg > 400

  return (
    <div className="flex flex-col items-center py-3">
      <div className="relative flex items-center gap-4">
        {/* Coffee cup SVG */}
        <div className="relative" style={{ width: 100, height: 120 }}>
          <svg width="100" height="120" viewBox="0 0 100 120">
            {/* Cup body */}
            <rect
              x="15"
              y="20"
              width="55"
              height="80"
              rx="5"
              fill="#f3f4f6"
              stroke="#d1d5db"
              strokeWidth="2"
            />
            {/* Handle */}
            <path
              d="M 70 40 C 85 40, 85 70, 70 70"
              fill="none"
              stroke="#d1d5db"
              strokeWidth="2"
            />
            {/* Liquid fill */}
            <motion.rect
              x="17"
              y={98 - pct * 76}
              width="51"
              rx="3"
              fill={overLimit ? "#ef4444" : goalMet ? "#22c55e" : "#92400e"}
              initial={{ height: 0 }}
              animate={{ height: pct * 76 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
            {/* Steam lines when hot */}
            {todayCups > 0 && (
              <>
                <motion.path
                  d="M 30 18 C 28 10, 32 5, 30 0"
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  animate={{ opacity: [0.3, 0.7, 0.3], y: [0, -3, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.path
                  d="M 45 18 C 43 10, 47 5, 45 0"
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  animate={{ opacity: [0.5, 0.8, 0.5], y: [0, -4, 0] }}
                  transition={{ duration: 2.3, repeat: Infinity, delay: 0.3 }}
                />
                <motion.path
                  d="M 55 18 C 53 10, 57 5, 55 0"
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  animate={{ opacity: [0.3, 0.6, 0.3], y: [0, -2, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: 0.6 }}
                />
              </>
            )}
          </svg>
        </div>
        {/* Stats next to cup */}
        <div className="flex flex-col gap-1">
          <p className="text-3xl font-bold text-theme-text-primary">
            {todayCups}
          </p>
          <p className="text-sm text-theme-text-tertiary">
            / {target} cups
          </p>
          <p className="mt-1 text-xs text-theme-text-secondary">
            {todayMg} mg caffeine
          </p>
        </div>
      </div>
      {overLimit && (
        <div className="mt-2 flex items-center gap-1 text-xs text-theme-text-secondary">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          Over 400mg daily limit
        </div>
      )}
      {goalMet && !overLimit && (
        <p className="mt-2 text-sm text-theme-text-secondary">Goal reached!</p>
      )}
    </div>
  )
}

function CaffeineBarChart({
  entries,
  target,
}: {
  entries: CaffeineEntry[]
  target: number
}) {
  const days = useMemo(() => {
    const result: { label: string; cups: number; mg: number; isToday: boolean }[] = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = getDateKey(d)
      const dayEntries = entries.filter((e) => e.date === key)
      const cups = dayEntries.reduce((s, e) => s + e.cups, 0)
      const mg = dayEntries.reduce((s, e) => s + e.amount, 0)
      result.push({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        cups,
        mg,
        isToday: i === 0,
      })
    }
    return result
  }, [entries])

  const maxVal = Math.max(target, ...days.map((d) => d.cups), 1)

  return (
    <div className="space-y-1.5">
      {days.map((d) => {
        const pct = Math.min((d.cups / maxVal) * 100, 100)
        const metGoal = d.cups >= target
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
                    : d.cups > 0
                      ? "bg-amber-500"
                      : "bg-transparent"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="w-12 text-right text-xs tabular-nums text-theme-text-secondary">
              {d.cups > 0 ? `${d.cups} cup${d.cups !== 1 ? "s" : ""}` : "---"}
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

export function CaffeineTrackerWidget({
  widget,
  onUpdate,
  progress,
  onComplete,
}: CaffeineTrackerWidgetProps) {
  const target = widget.target || 2
  const data = widget.caffeineData ?? {
    entries: [],
    weeklyAverage: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalCaffeineMg: 0,
  }
  const entries = data.entries ?? []

  const [selectedBeverage, setSelectedBeverage] = useState("coffee")
  const [customCups, setCustomCups] = useState("")
  const [showHistory, setShowHistory] = useState(false)

  const today = getDateKey()
  const todayEntries = useMemo(
    () => entries.filter((e) => e.date === today),
    [entries, today]
  )
  const todayCups = useMemo(
    () => todayEntries.reduce((s, e) => s + e.cups, 0),
    [todayEntries]
  )
  const todayMg = useMemo(
    () => todayEntries.reduce((s, e) => s + e.amount, 0),
    [todayEntries]
  )
  const goalAlreadyMet = todayCups >= target

  const lateEntries = todayEntries.filter((e) => isLateCaffeine(e.loggedAt))

  // ------- Handlers -------

  const handleLogCaffeine = useCallback(
    (cups: number) => {
      if (cups <= 0) return
      const bev = getBeverageInfo(selectedBeverage)
      const mg = Math.round(cups * bev.mgPerCup)
      const now = new Date()
      const newEntry: CaffeineEntry = {
        date: today,
        amount: mg,
        beverage: selectedBeverage,
        cups,
        loggedAt: now.toISOString(),
      }
      const newEntries = [...entries, newEntry]
      const newTodayCups = todayCups + cups
      const { current, best } = calculateStreak(newEntries, target)

      // Weekly average
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 6)
      const weekKey = getDateKey(weekAgo)
      const weekEntries = newEntries.filter((e) => e.date >= weekKey)
      const weekByDate = new Map<string, number>()
      for (const e of weekEntries) {
        weekByDate.set(e.date, (weekByDate.get(e.date) ?? 0) + e.cups)
      }
      const weeklyAverage = weekByDate.size > 0
        ? Math.round((Array.from(weekByDate.values()).reduce((a, b) => a + b, 0) / weekByDate.size) * 10) / 10
        : 0

      const totalCaffeineMg = (data.totalCaffeineMg ?? 0) + mg

      onUpdate({
        caffeineData: {
          entries: newEntries,
          weeklyAverage,
          currentStreak: current,
          bestStreak: Math.max(best, data.bestStreak ?? 0),
          totalCaffeineMg,
        },
      })

      if (!goalAlreadyMet && newTodayCups >= target) {
        onComplete()
      }

      setCustomCups("")
    },
    [entries, today, todayCups, target, selectedBeverage, goalAlreadyMet, data, onUpdate, onComplete]
  )

  const handleDeleteEntry = useCallback(
    (loggedAt: string) => {
      const deleted = entries.find((e) => e.loggedAt === loggedAt)
      const newEntries = entries.filter((e) => e.loggedAt !== loggedAt)
      const { current, best } = calculateStreak(newEntries, target)

      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 6)
      const weekKey = getDateKey(weekAgo)
      const weekEntries = newEntries.filter((e) => e.date >= weekKey)
      const weekByDate = new Map<string, number>()
      for (const e of weekEntries) {
        weekByDate.set(e.date, (weekByDate.get(e.date) ?? 0) + e.cups)
      }
      const weeklyAverage = weekByDate.size > 0
        ? Math.round((Array.from(weekByDate.values()).reduce((a, b) => a + b, 0) / weekByDate.size) * 10) / 10
        : 0

      const totalCaffeineMg = Math.max(0, (data.totalCaffeineMg ?? 0) - (deleted?.amount ?? 0))

      onUpdate({
        caffeineData: {
          entries: newEntries,
          weeklyAverage,
          currentStreak: current,
          bestStreak: Math.max(best, data.bestStreak ?? 0),
          totalCaffeineMg,
        },
      })
    },
    [entries, target, data, onUpdate]
  )

  // ------- Grouped history -------

  const groupedHistory = useMemo(() => {
    const byDate = new Map<string, CaffeineEntry[]>()
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

  // ------- Render -------

  return (
    <div className="space-y-5 px-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
          <Coffee className="h-6 w-6 text-amber-700" />
        </div>
        <div>
          <h3 className="font-semibold text-theme-text-primary">
            {widget.name || "Caffeine Intake"}
          </h3>
          <p className="text-sm text-theme-text-tertiary">
            Track your daily caffeine consumption
          </p>
        </div>
      </div>

      {/* Coffee cup visualization */}
      <CaffeineMeterVisualization
        todayCups={todayCups}
        todayMg={todayMg}
        target={target}
      />

      {/* Beverage selector */}
      <div className="grid grid-cols-3 gap-2">
        {BEVERAGES.map((bev) => {
          const active = selectedBeverage === bev.id
          return (
            <button
              key={bev.id}
              onClick={() => setSelectedBeverage(bev.id)}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-xs transition-all ${
                active
                  ? "bg-amber-100 text-theme-text-primary ring-2 ring-amber-300"
                  : "bg-gray-50 text-theme-text-secondary hover:bg-gray-100"
              }`}
            >
              <span className="text-lg">{bev.icon}</span>
              <span className="text-[11px] font-medium">{bev.label}</span>
              <span className="text-3xs text-theme-text-tertiary">
                {bev.mgPerCup}mg/cup
              </span>
            </button>
          )
        })}
      </div>

      {/* Quick-add buttons */}
      <div className="flex gap-2">
        {[0.5, 1, 2].map((cups) => (
          <Button
            key={cups}
            variant="outline"
            size="sm"
            onClick={() => handleLogCaffeine(cups)}
            className="flex-1 text-sm font-medium"
          >
            +{cups} {cups === 1 ? "cup" : "cups"}
          </Button>
        ))}
      </div>

      {/* Custom amount */}
      <div className="flex gap-2">
        <input
          type="number"
          value={customCups}
          onChange={(e) => setCustomCups(e.target.value)}
          placeholder="Custom cups"
          className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm"
          min="0.5"
          max="20"
          step="0.5"
        />
        {customCups && Number(customCups) > 0 && (
          <Button
            onClick={() => handleLogCaffeine(Number(customCups))}
            className="bg-amber-600 text-white hover:bg-amber-700"
            size="sm"
          >
            <Plus className="mr-1 h-4 w-4" />
            Log
          </Button>
        )}
      </div>

      {/* Late caffeine warning */}
      {lateEntries.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-theme-text-primary">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            {lateEntries.length} drink{lateEntries.length > 1 ? "s" : ""} after
            2 PM — may affect sleep
          </span>
        </div>
      )}

      {/* Today's log */}
      {todayEntries.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-theme-text-tertiary">
            Today&apos;s Drinks
          </p>
          <div className="space-y-1.5">
            {todayEntries.map((e) => {
              const bev = getBeverageInfo(e.beverage)
              const late = isLateCaffeine(e.loggedAt)
              return (
                <div
                  key={e.loggedAt}
                  className={`flex items-center justify-between rounded-lg bg-white px-3 py-2 ${late ? "ring-1 ring-amber-200" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{bev.icon}</span>
                    <span className="text-sm font-medium">
                      {e.cups} {e.cups === 1 ? "cup" : "cups"}
                    </span>
                    <Badge variant="secondary" className="text-2xs">
                      {bev.label}
                    </Badge>
                    <span className="text-2xs text-theme-text-tertiary">
                      {e.amount}mg
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {late && (
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                    )}
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
          Last 7 Days
        </h4>
        <CaffeineBarChart entries={entries} target={target} />
      </div>

      {/* Stats grid */}
      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-theme-text-tertiary">
          <TrendingUp className="h-3.5 w-3.5" /> Stats
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-xl font-bold text-theme-text-primary">
              {todayCups}
            </p>
            <p className="text-2xs uppercase tracking-wider text-theme-text-tertiary">
              Today (cups)
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-xl font-bold text-theme-text-primary">
              {todayMg}mg
            </p>
            <p className="text-2xs uppercase tracking-wider text-theme-text-tertiary">
              Today (mg)
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-xl font-bold text-theme-text-primary">
              {data.weeklyAverage ?? 0}
            </p>
            <p className="text-2xs uppercase tracking-wider text-theme-text-tertiary">
              Weekly Avg
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Zap className="h-4 w-4 text-amber-500" />
              <p className="text-xl font-bold text-theme-text-primary">
                {Math.round((data.totalCaffeineMg ?? 0) / 1000)}g
              </p>
            </div>
            <p className="text-2xs uppercase tracking-wider text-theme-text-tertiary">
              Lifetime
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
                    const dayCups = dayEntries.reduce((s, e) => s + e.cups, 0)
                    const dayMg = dayEntries.reduce((s, e) => s + e.amount, 0)
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
                            {dayCups} cups ({dayMg}mg)
                          </span>
                        </div>
                        <div className="space-y-1">
                          {dayEntries.map((e) => {
                            const bev = getBeverageInfo(e.beverage)
                            return (
                              <div
                                key={e.loggedAt}
                                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5"
                              >
                                <div className="flex items-center gap-2">
                                  <span>{bev.icon}</span>
                                  <span className="text-sm">
                                    {e.cups} {e.cups === 1 ? "cup" : "cups"}
                                  </span>
                                  <span className="text-xs text-theme-text-tertiary">
                                    {e.amount}mg
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
                            )
                          })}
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
