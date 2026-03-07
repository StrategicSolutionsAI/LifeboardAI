"use client"

import { useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Droplets,
  Plus,
  TrendingUp,
  Flame,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  Coffee,
  GlassWater,
  CupSoda,
  Sparkles,
  Zap,
} from "lucide-react"
import type { WidgetInstance } from "@/types/widgets"
import { motion, AnimatePresence } from "framer-motion"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WaterIntakeWidgetProps {
  widget: WidgetInstance
  onUpdate: (updates: Partial<WidgetInstance>) => void
  progress: { value: number; streak: number; isToday: boolean }
  onComplete: () => void
}

interface WaterEntry {
  date: string
  amount: number
  beverage: string
  loggedAt: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEVERAGE_TYPES = [
  { id: "water", label: "Water", Icon: Droplets },
  { id: "tea", label: "Tea", Icon: Coffee },
  { id: "coffee", label: "Coffee", Icon: Coffee },
  { id: "juice", label: "Juice", Icon: CupSoda },
  { id: "sparkling", label: "Sparkling", Icon: Sparkles },
  { id: "other", label: "Other", Icon: GlassWater },
] as const

const QUICK_ADD_BY_UNIT: Record<string, Array<{ label: string; amount: number }>> = {
  cups: [
    { label: "1 cup", amount: 1 },
    { label: "\u00BD cup", amount: 0.5 },
    { label: "2 cups", amount: 2 },
  ],
  ml: [
    { label: "250 ml", amount: 250 },
    { label: "500 ml", amount: 500 },
    { label: "750 ml", amount: 750 },
  ],
  oz: [
    { label: "8 oz", amount: 8 },
    { label: "16 oz", amount: 16 },
    { label: "32 oz", amount: 32 },
  ],
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateKey(d: Date): string {
  return d.toISOString().split("T")[0]
}

function calculateStreak(
  entries: Array<{ date: string; amount: number }>,
  target: number
): number {
  if (!entries.length) return 0
  const dailyTotals: Record<string, number> = {}
  for (const e of entries) {
    dailyTotals[e.date] = (dailyTotals[e.date] || 0) + e.amount
  }
  const metDays = Object.entries(dailyTotals)
    .filter(([, total]) => total >= target)
    .map(([date]) => date)
    .sort()
    .reverse()

  if (!metDays.length) return 0
  const today = getDateKey(new Date())
  const yesterday = getDateKey(new Date(Date.now() - 86400000))
  if (metDays[0] !== today && metDays[0] !== yesterday) return 0

  let streak = 0
  let expected = metDays[0]
  for (const date of metDays) {
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

function getBeverageIcon(beverage: string) {
  const found = BEVERAGE_TYPES.find((b) => b.id === beverage)
  return found ? found.Icon : GlassWater
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function WaterFillVisualization({
  current,
  target,
  unit,
}: {
  current: number
  target: number
  unit: string
}) {
  const pct = Math.min(current / target, 1)
  const fillColor = pct >= 1 ? "#10b981" : "#3b82f6"
  // The glass interior goes from y=15 to y=145 (height 130)
  const fillHeight = pct * 130

  return (
    <div className="relative flex flex-col items-center">
      <svg width="120" height="160" viewBox="0 0 120 160">
        {/* Glass outline */}
        <path
          d="M30 12 L25 138 Q25 148 35 148 L85 148 Q95 148 95 138 L90 12 Z"
          fill="none"
          stroke="#d1d5db"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Clip path for interior */}
        <defs>
          <clipPath id="waterGlassClip">
            <path d="M31 13 L26 137 Q26 147 36 147 L84 147 Q94 147 94 137 L89 13 Z" />
          </clipPath>
        </defs>
        {/* Animated water fill */}
        <motion.rect
          clipPath="url(#waterGlassClip)"
          x="20"
          width="80"
          initial={{ y: 147, height: 0 }}
          animate={{
            y: 147 - fillHeight,
            height: fillHeight,
            fill: fillColor,
          }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        {/* Subtle wave at water surface */}
        {pct > 0.05 && pct < 1 && (
          <motion.ellipse
            clipPath="url(#waterGlassClip)"
            cx="60"
            rx="35"
            fill={fillColor}
            opacity={0.25}
            initial={{ cy: 147 }}
            animate={{ cy: 147 - fillHeight }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        )}
        {/* Completion check */}
        {pct >= 1 && (
          <motion.g
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
          >
            <circle cx="60" cy="80" r="18" fill="#10b981" opacity={0.9} />
            <path
              d="M50 80 L57 87 L71 73"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.g>
        )}
      </svg>
      {/* Numeric display */}
      <div className="text-center mt-1">
        <span className="text-2xl font-bold text-theme-text-primary">
          {Number.isInteger(current) ? current : current.toFixed(1)}
        </span>
        <span className="text-sm text-theme-text-tertiary ml-1">
          / {target} {unit}
        </span>
      </div>
      {pct >= 1 && (
        <Badge
          variant="secondary"
          className="mt-1 bg-emerald-100 text-theme-text-primary text-2xs"
        >
          Goal met!
        </Badge>
      )}
    </div>
  )
}

function IntakeBarChart({
  days,
  target,
  unit,
}: {
  days: Array<{ date: string; label: string; total: number | null }>
  target: number
  unit: string
}) {
  const maxVal = Math.max(target, ...days.map((d) => d.total ?? 0), 1)

  return (
    <div className="space-y-1.5">
      {days.map((day, i) => {
        const pct = day.total != null ? (day.total / maxVal) * 100 : 0
        const color =
          day.total == null
            ? "bg-theme-neutral-200"
            : day.total >= target
              ? "bg-emerald-500"
              : day.total >= target * 0.75
                ? "bg-blue-400"
                : "bg-amber-400"
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
            <div className="flex-1 h-5 bg-theme-neutral-100 rounded-full overflow-hidden relative">
              <motion.div
                className={`h-full rounded-full ${color}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.06 }}
              />
              <div
                className="absolute top-0 h-full w-px bg-theme-text-tertiary/30"
                style={{ left: `${(target / maxVal) * 100}%` }}
              />
            </div>
            <span className="w-12 text-xs text-right tabular-nums text-theme-text-secondary">
              {day.total != null
                ? `${Number.isInteger(day.total) ? day.total : day.total.toFixed(1)}`
                : "---"}
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

export function WaterIntakeWidget({
  widget,
  onUpdate,
  onComplete,
}: WaterIntakeWidgetProps) {
  const target = widget.target || 8
  const unit = widget.unit || "cups"
  const entries = useMemo(
    () => widget.waterData?.entries || [],
    [widget.waterData?.entries]
  )
  const today = getDateKey(new Date())

  // Form state
  const [selectedBeverage, setSelectedBeverage] = useState("water")
  const [customAmount, setCustomAmount] = useState("")
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Derived data
  const todayEntries = useMemo(
    () =>
      entries
        .filter((e) => e.date === today)
        .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)),
    [entries, today]
  )

  const todayTotal = useMemo(
    () => todayEntries.reduce((sum, e) => sum + e.amount, 0),
    [todayEntries]
  )

  const last7Days = useMemo(() => {
    const days: Array<{
      date: string
      label: string
      total: number | null
    }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const key = getDateKey(d)
      const dayEntries = entries.filter((e) => e.date === key)
      const total =
        dayEntries.length > 0
          ? dayEntries.reduce((s, e) => s + e.amount, 0)
          : null
      days.push({ date: key, label: DAY_LABELS[d.getDay()], total })
    }
    return days
  }, [entries])

  const weeklyAverage = useMemo(() => {
    const logged = last7Days.filter((d) => d.total != null)
    if (!logged.length) return 0
    return Number(
      (logged.reduce((s, d) => s + (d.total ?? 0), 0) / logged.length).toFixed(
        1
      )
    )
  }, [last7Days])

  const currentStreak = useMemo(
    () => calculateStreak(entries, target),
    [entries, target]
  )
  const bestStreak = Math.max(
    widget.waterData?.bestStreak || 0,
    currentStreak
  )

  // Quick-add presets for current unit
  const quickAddPresets = QUICK_ADD_BY_UNIT[unit] || QUICK_ADD_BY_UNIT.cups

  // Handlers
  const handleLogWater = useCallback(
    (amount: number) => {
      const newEntry: WaterEntry = {
        date: today,
        amount,
        beverage: selectedBeverage,
        loggedAt: new Date().toISOString(),
      }
      const updatedEntries = [...entries, newEntry]
      const newStreak = calculateStreak(updatedEntries, target)

      onUpdate({
        waterData: {
          entries: updatedEntries,
          weeklyAverage,
          currentStreak: newStreak,
          bestStreak: Math.max(bestStreak, newStreak),
          preferredUnit: unit,
        },
      })

      const newTotal = todayTotal + amount
      if (newTotal >= target && todayTotal < target) {
        onComplete()
      }
    },
    [
      today,
      selectedBeverage,
      entries,
      todayTotal,
      target,
      weeklyAverage,
      bestStreak,
      unit,
      onUpdate,
      onComplete,
    ]
  )

  const handleDeleteEntry = useCallback(
    (loggedAt: string) => {
      const updatedEntries = entries.filter((e) => e.loggedAt !== loggedAt)
      const newStreak = calculateStreak(updatedEntries, target)

      onUpdate({
        waterData: {
          entries: updatedEntries,
          weeklyAverage: widget.waterData?.weeklyAverage ?? 0,
          currentStreak: newStreak,
          bestStreak: Math.max(widget.waterData?.bestStreak || 0, newStreak),
          preferredUnit: unit,
        },
      })
    },
    [entries, target, widget.waterData, unit, onUpdate]
  )

  const handleCustomAdd = useCallback(() => {
    const amt = parseFloat(customAmount)
    if (!isNaN(amt) && amt > 0) {
      handleLogWater(amt)
      setCustomAmount("")
      setShowCustomInput(false)
    }
  }, [customAmount, handleLogWater])

  // Group history entries by date
  const historyByDate = useMemo(() => {
    const grouped: Record<string, WaterEntry[]> = {}
    for (const e of entries) {
      if (!grouped[e.date]) grouped[e.date] = []
      grouped[e.date].push(e)
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 14)
  }, [entries])

  return (
    <div className="mt-4 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <Droplets className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-theme-text-primary">
            Water Intake
          </h3>
          <p className="text-xs text-theme-text-tertiary mt-0.5">
            Target: {target} {unit} per day
          </p>
        </div>
        {currentStreak >= 2 && (
          <Badge variant="secondary" className="gap-1">
            <Flame className="h-3 w-3 text-orange-500" />
            {currentStreak} days
          </Badge>
        )}
      </div>

      {/* Water Fill Visualization */}
      <div className="rounded-2xl bg-gradient-to-b from-blue-50 to-cyan-50 p-6 flex justify-center">
        <WaterFillVisualization
          current={todayTotal}
          target={target}
          unit={unit}
        />
      </div>

      {/* Beverage Type Selector */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-2">
          Beverage Type
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {BEVERAGE_TYPES.map((bev) => {
            const isSelected = selectedBeverage === bev.id
            return (
              <motion.button
                key={bev.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedBeverage(bev.id)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  isSelected
                    ? "border-blue-400 bg-blue-50 text-theme-text-primary shadow-sm"
                    : "border-theme-neutral-200 bg-white text-theme-text-secondary hover:border-theme-neutral-300"
                }`}
              >
                <bev.Icon className="h-3.5 w-3.5" />
                {bev.label}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Quick-Add Buttons */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-2">
          Quick Add
        </h4>
        <div className="flex gap-2 flex-wrap">
          {quickAddPresets.map((preset) => (
            <motion.button
              key={preset.label}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleLogWater(preset.amount)}
              className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-medium text-theme-text-primary hover:bg-blue-100 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {preset.label}
            </motion.button>
          ))}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCustomInput(!showCustomInput)}
            className="flex items-center gap-1.5 rounded-xl border border-theme-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-theme-text-secondary hover:border-theme-neutral-300 transition-colors"
          >
            <Zap className="h-3.5 w-3.5" />
            Custom
          </motion.button>
        </div>

        {/* Custom Amount Input */}
        <AnimatePresence>
          {showCustomInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 mt-2">
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCustomAdd()}
                  placeholder={`Amount in ${unit}`}
                  className="flex-1 rounded-lg border border-theme-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <Button
                  onClick={handleCustomAdd}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={
                    !customAmount || isNaN(parseFloat(customAmount)) || parseFloat(customAmount) <= 0
                  }
                >
                  Add
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Today's Timeline */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-2 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Today&apos;s Intake
        </h4>
        {todayEntries.length === 0 ? (
          <div className="rounded-xl border border-theme-neutral-200 bg-theme-surface-alt p-4 text-center">
            <Droplets className="h-8 w-8 mx-auto mb-2 text-blue-200" />
            <p className="text-sm font-medium text-theme-text-secondary mb-0.5">
              No drinks logged yet
            </p>
            <p className="text-xs text-theme-text-tertiary">
              Use the buttons above to log your first drink
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {todayEntries.map((entry) => {
              const BevIcon = getBeverageIcon(entry.beverage)
              const time = new Date(entry.loggedAt).toLocaleTimeString(
                "en-US",
                { hour: "numeric", minute: "2-digit" }
              )
              return (
                <div
                  key={entry.loggedAt}
                  className="flex items-center gap-3 rounded-lg border border-theme-neutral-200 bg-white p-2.5 text-xs"
                >
                  <BevIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  <span className="text-theme-text-tertiary w-16 flex-shrink-0">
                    {time}
                  </span>
                  <span className="font-medium text-theme-text-primary flex-1">
                    {Number.isInteger(entry.amount)
                      ? entry.amount
                      : entry.amount.toFixed(1)}{" "}
                    {unit}
                  </span>
                  <span className="text-theme-text-tertiary capitalize">
                    {entry.beverage}
                  </span>
                  <button
                    onClick={() => handleDeleteEntry(entry.loggedAt)}
                    className="p-1 rounded hover:bg-red-50 text-theme-neutral-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 7-Day Intake Chart */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-3">
          Last 7 Days
        </h4>
        <IntakeBarChart days={last7Days} target={target} unit={unit} />
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
              {Number.isInteger(todayTotal)
                ? todayTotal
                : todayTotal.toFixed(1)}
            </div>
            <div className="text-2xs text-theme-text-tertiary uppercase tracking-wide">
              Today ({unit})
            </div>
          </div>
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">
              {weeklyAverage}
            </div>
            <div className="text-2xs text-theme-text-tertiary uppercase tracking-wide">
              Weekly Avg
            </div>
          </div>
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">
              {currentStreak}
            </div>
            <div className="text-2xs text-theme-text-tertiary uppercase tracking-wide">
              Current Streak
            </div>
          </div>
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">
              {bestStreak}
            </div>
            <div className="text-2xs text-theme-text-tertiary uppercase tracking-wide">
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
              <div className="mt-2 space-y-3">
                {historyByDate.length === 0 ? (
                  <p className="text-xs text-theme-text-tertiary text-center py-4">
                    No entries yet. Log your first drink!
                  </p>
                ) : (
                  historyByDate.map(([date, dayEntries]) => {
                    const dayTotal = dayEntries.reduce(
                      (s, e) => s + e.amount,
                      0
                    )
                    const metGoal = dayTotal >= target
                    return (
                      <div key={date}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-theme-text-primary">
                            {new Date(date + "T12:00:00").toLocaleDateString(
                              "en-US",
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </span>
                          <span className="text-xs font-semibold text-theme-text-primary">
                            {Number.isInteger(dayTotal)
                              ? dayTotal
                              : dayTotal.toFixed(1)}{" "}
                            {unit}
                          </span>
                          {metGoal && (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-100 text-theme-text-primary text-3xs px-1.5 py-0"
                            >
                              Goal
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          {dayEntries
                            .sort((a, b) =>
                              b.loggedAt.localeCompare(a.loggedAt)
                            )
                            .map((entry) => {
                              const BevIcon = getBeverageIcon(entry.beverage)
                              const time = new Date(
                                entry.loggedAt
                              ).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                              return (
                                <div
                                  key={entry.loggedAt}
                                  className="flex items-center gap-3 rounded-lg border border-theme-neutral-200 bg-white p-2 text-xs"
                                >
                                  <BevIcon className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                                  <span className="text-theme-text-tertiary w-14 flex-shrink-0">
                                    {time}
                                  </span>
                                  <span className="font-medium text-theme-text-primary flex-1">
                                    {Number.isInteger(entry.amount)
                                      ? entry.amount
                                      : entry.amount.toFixed(1)}{" "}
                                    {unit}
                                  </span>
                                  <span className="text-theme-text-tertiary capitalize">
                                    {entry.beverage}
                                  </span>
                                  <button
                                    onClick={() =>
                                      handleDeleteEntry(entry.loggedAt)
                                    }
                                    className="p-1 rounded hover:bg-red-50 text-theme-neutral-300 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )
                            })}
                        </div>
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
