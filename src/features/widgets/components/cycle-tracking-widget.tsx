"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  CalendarHeart,
  Flame,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  Droplets,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react"
import type { WidgetInstance } from "@/types/widgets"
import { motion, AnimatePresence } from "framer-motion"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CycleTrackingWidgetProps {
  widget: WidgetInstance
  onUpdate: (updates: Partial<WidgetInstance>) => void
  progress: { value: number; streak: number; isToday: boolean }
  onComplete: () => void
}

interface CycleEntry {
  date: string
  flowIntensity: "none" | "light" | "medium" | "heavy"
  symptoms: string[]
  mood: number
  notes?: string
  periodStart?: boolean
  loggedAt: string
}

interface SupabaseRow {
  date: string
  flow_intensity: string
  symptoms: string[]
  mood: number | null
  notes: string | null
  period_start: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLOW_OPTIONS = [
  { value: "none" as const, label: "None", color: "#94a3b8", dots: 0 },
  { value: "light" as const, label: "Light", color: "#f9a8d4", dots: 1 },
  { value: "medium" as const, label: "Medium", color: "#f472b6", dots: 2 },
  { value: "heavy" as const, label: "Heavy", color: "#ec4899", dots: 3 },
]

const SYMPTOM_OPTIONS = [
  "Cramps", "Headache", "Bloating", "Fatigue", "Back pain",
  "Breast tenderness", "Nausea", "Acne", "Insomnia", "Cravings",
  "Mood swings", "Irritability",
]

const MOOD_OPTIONS = [
  { value: 1, emoji: "\uD83D\uDE22", label: "Awful" },
  { value: 2, emoji: "\uD83D\uDE15", label: "Bad" },
  { value: 3, emoji: "\uD83D\uDE10", label: "Okay" },
  { value: 4, emoji: "\uD83D\uDE0A", label: "Good" },
  { value: 5, emoji: "\uD83D\uDE01", label: "Great" },
]

const SPRING_TRANSITION = { type: "spring" as const, stiffness: 300, damping: 30 }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateKey(d: Date): string {
  return d.toISOString().split("T")[0]
}

function calculateStreak(entries: CycleEntry[]): number {
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
    } else break
  }
  return streak
}

function computeAverageCycleLength(entries: CycleEntry[]): number | null {
  const periodStarts = entries
    .filter((e) => e.periodStart)
    .map((e) => e.date)
    .sort()
  if (periodStarts.length < 2) return null

  const gaps: number[] = []
  for (let i = 1; i < periodStarts.length; i++) {
    const a = new Date(periodStarts[i - 1] + "T12:00:00")
    const b = new Date(periodStarts[i] + "T12:00:00")
    const diffDays = Math.round((b.getTime() - a.getTime()) / 86400000)
    if (diffDays >= 15 && diffDays <= 60) gaps.push(diffDays)
  }
  if (!gaps.length) return null
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
}

function predictNextPeriod(entries: CycleEntry[], avgLength: number | null): string | null {
  if (!avgLength) return null
  const lastStart = entries
    .filter((e) => e.periodStart)
    .map((e) => e.date)
    .sort()
    .pop()
  if (!lastStart) return null
  const d = new Date(lastStart + "T12:00:00")
  d.setDate(d.getDate() + avgLength)
  return getDateKey(d)
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00")
  return Math.round((Date.now() - d.getTime()) / 86400000)
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00")
  return Math.round((d.getTime() - Date.now()) / 86400000)
}

function mapRowToEntry(row: SupabaseRow): CycleEntry {
  return {
    date: typeof row.date === 'string' ? row.date.slice(0, 10) : row.date,
    flowIntensity: row.flow_intensity as CycleEntry["flowIntensity"],
    symptoms: row.symptoms || [],
    mood: row.mood ?? 3,
    notes: row.notes ?? undefined,
    periodStart: row.period_start,
    loggedAt: row.created_at,
  }
}

// ---------------------------------------------------------------------------
// Cycle Day Ring
// ---------------------------------------------------------------------------

function CycleDayRing({ day, total }: { day: number | null; total: number | null }) {
  const pct = day && total ? Math.min((day / total) * 100, 100) : 0
  const circumference = 2 * Math.PI * 22 // r=22
  const dashLength = (pct / 100) * circumference

  return (
    <div className="relative w-16 h-16">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="22" fill="none" stroke="#fce7f3" strokeWidth="4" />
        {day && total && (
          <circle
            cx="28" cy="28" r="22"
            fill="none"
            stroke="url(#cycleGrad)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${dashLength} ${circumference}`}
          />
        )}
        <defs>
          <linearGradient id="cycleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-theme-text-primary">
          {day ?? "--"}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cycle Calendar (circle heatmap)
// ---------------------------------------------------------------------------

function CycleCalendar({ entries }: { entries: CycleEntry[] }) {
  const weeks = useMemo(() => {
    const entryMap = new Map(entries.map((e) => [e.date, e]))
    const today = new Date()
    const result: Array<Array<{ date: string; dayNum: number; entry: CycleEntry | null; isToday: boolean }>> = []
    const startDay = new Date(today)
    startDay.setDate(startDay.getDate() - 34)
    startDay.setDate(startDay.getDate() - startDay.getDay())

    let week: Array<{ date: string; dayNum: number; entry: CycleEntry | null; isToday: boolean }> = []
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 1)

    for (let d = new Date(startDay); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = getDateKey(d)
      week.push({
        date: key,
        dayNum: d.getDate(),
        entry: entryMap.get(key) || null,
        isToday: key === getDateKey(today),
      })
      if (week.length === 7) {
        result.push(week)
        week = []
      }
    }
    if (week.length) result.push(week)
    return result
  }, [entries])

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"]

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {dayLabels.map((l, i) => (
          <div key={i} className="text-[9px] text-center text-theme-text-tertiary font-semibold">
            {l}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1.5 mb-1.5">
          {week.map((day) => {
            const flow = day.entry?.flowIntensity
            let bg = "bg-theme-neutral-100"
            let textColor = ""
            if (flow === "light") { bg = "bg-pink-200"; textColor = "text-pink-700" }
            else if (flow === "medium") { bg = "bg-pink-400"; textColor = "text-white" }
            else if (flow === "heavy") { bg = "bg-pink-600"; textColor = "text-white" }
            else if (day.entry && flow === "none") { bg = "bg-slate-100"; textColor = "text-slate-400" }

            return (
              <div
                key={day.date}
                className={`aspect-square rounded-full flex items-center justify-center ${bg} ${textColor} ${
                  day.isToday ? "ring-2 ring-pink-500 ring-offset-2" : ""
                }`}
                title={`${day.date}${flow && flow !== "none" ? ` \u2014 ${flow} flow` : ""}`}
              >
                {(flow && flow !== "none") || day.isToday ? (
                  <span className="text-[9px] font-semibold">{day.dayNum}</span>
                ) : null}
              </div>
            )
          })}
        </div>
      ))}
      <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-pink-100/60">
        {FLOW_OPTIONS.filter((f) => f.value !== "none").map((f) => (
          <div key={f.value} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: f.color }} />
            <span className="text-[10px] text-theme-text-tertiary font-medium">{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CycleTrackingWidget({
  widget,
  onUpdate,
  onComplete,
}: CycleTrackingWidgetProps) {
  const [entries, setEntries] = useState<CycleEntry[]>(() => widget.cycleData?.entries || [])
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [historyLimit, setHistoryLimit] = useState(7)

  const today = getDateKey(new Date())

  // Form state
  const [selectedFlow, setSelectedFlow] = useState<CycleEntry["flowIntensity"]>("none")
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [selectedMood, setSelectedMood] = useState<number>(3)
  const [notes, setNotes] = useState("")
  const [isPeriodStart, setIsPeriodStart] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showCalendar, setShowCalendar] = useState(true)

  // Load from Supabase on mount
  useEffect(() => {
    let cancelled = false
    async function fetchEntries() {
      try {
        const res = await fetch("/api/widgets/cycle-tracking?limit=90")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.entries) {
          const mapped = data.entries.map(mapRowToEntry)
          setEntries(mapped)
          updateWidgetState(mapped)
        }
      } catch {
        // silently fail — will use cached data from widget
      }
    }
    fetchEntries()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Derived data
  const todayEntry = useMemo(() => entries.find((e) => e.date === today), [entries, today])
  const currentStreak = useMemo(() => calculateStreak(entries), [entries])
  const bestStreak = Math.max(widget.cycleData?.bestStreak || 0, currentStreak)
  const avgCycleLength = useMemo(() => computeAverageCycleLength(entries), [entries])
  const nextPeriod = useMemo(() => predictNextPeriod(entries, avgCycleLength), [entries, avgCycleLength])

  const lastPeriodStart = useMemo(() => {
    return entries
      .filter((e) => e.periodStart)
      .map((e) => e.date)
      .sort()
      .pop() || null
  }, [entries])

  const currentCycleDay = useMemo(() => {
    if (!lastPeriodStart) return null
    return daysSince(lastPeriodStart) + 1
  }, [lastPeriodStart])

  const daysUntilNext = useMemo(() => {
    if (!nextPeriod) return null
    return Math.max(0, daysUntil(nextPeriod))
  }, [nextPeriod])

  const subtitleText = useMemo(() => {
    if (!lastPeriodStart) return "Start tracking to see predictions"
    if (currentCycleDay && currentCycleDay <= 7) return "Period phase \u2014 take it easy"
    if (daysUntilNext !== null && daysUntilNext <= 3 && daysUntilNext > 0) return "Period expected soon"
    return "Track your cycle, symptoms & predictions"
  }, [lastPeriodStart, currentCycleDay, daysUntilNext])

  // Pre-fill form when today's entry exists
  useEffect(() => {
    if (todayEntry && !isEditing) {
      setSelectedFlow(todayEntry.flowIntensity)
      setSelectedSymptoms(todayEntry.symptoms)
      setSelectedMood(todayEntry.mood)
      setNotes(todayEntry.notes || "")
      setIsPeriodStart(todayEntry.periodStart || false)
    }
  }, [todayEntry, isEditing])

  function updateWidgetState(updatedEntries: CycleEntry[]) {
    const streak = calculateStreak(updatedEntries)
    onUpdate({
      cycleData: {
        entries: updatedEntries,
        averageCycleLength: computeAverageCycleLength(updatedEntries) ?? undefined,
        lastPeriodStart: updatedEntries
          .filter((e) => e.periodStart)
          .map((e) => e.date)
          .sort()
          .pop(),
        currentStreak: streak,
        bestStreak: Math.max(bestStreak, streak),
      },
    })
  }

  const handleSave = useCallback(async () => {
    setIsSyncing(true)
    setSyncError(null)

    const newEntry: CycleEntry = {
      date: today,
      flowIntensity: selectedFlow,
      symptoms: selectedSymptoms,
      mood: selectedMood,
      notes: notes.trim() || undefined,
      periodStart: isPeriodStart,
      loggedAt: new Date().toISOString(),
    }

    const hadTodayEntry = entries.some((e) => e.date === today)
    const updatedEntries = entries.filter((e) => e.date !== today)
    updatedEntries.push(newEntry)
    updatedEntries.sort((a, b) => a.date.localeCompare(b.date))
    setEntries(updatedEntries)
    updateWidgetState(updatedEntries)

    if (!hadTodayEntry) onComplete()

    try {
      const res = await fetch("/api/widgets/cycle-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          flow_intensity: selectedFlow,
          symptoms: selectedSymptoms,
          mood: selectedMood,
          notes: notes.trim() || null,
          period_start: isPeriodStart,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setSyncError(errData.error || "Failed to save")
      }
    } catch {
      setSyncError("Network error \u2014 entry saved locally")
    } finally {
      setIsSyncing(false)
      setIsEditing(false)
    }
  }, [today, selectedFlow, selectedSymptoms, selectedMood, notes, isPeriodStart, entries, bestStreak, onUpdate, onComplete])

  const handleDelete = useCallback(async (date: string) => {
    const updatedEntries = entries.filter((e) => e.date !== date)
    setEntries(updatedEntries)
    updateWidgetState(updatedEntries)

    try {
      await fetch(`/api/widgets/cycle-tracking?date=${date}`, { method: "DELETE" })
    } catch {
      // silently fail
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, bestStreak, onUpdate])

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    )
  }

  const startEditing = () => {
    if (todayEntry) {
      setSelectedFlow(todayEntry.flowIntensity)
      setSelectedSymptoms(todayEntry.symptoms)
      setSelectedMood(todayEntry.mood)
      setNotes(todayEntry.notes || "")
      setIsPeriodStart(todayEntry.periodStart || false)
    } else {
      setSelectedFlow("none")
      setSelectedSymptoms([])
      setSelectedMood(3)
      setNotes("")
      setIsPeriodStart(false)
    }
    setIsEditing(true)
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (entries.length === 0 && !isEditing) {
    return (
      <div className="mt-4 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-sm">
            <CalendarHeart className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-theme-text-primary">Cycle Tracker</h3>
            <p className="text-xs text-theme-text-tertiary mt-0.5">Start tracking to see predictions</p>
          </div>
        </div>

        <div className="text-center py-8 space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center">
            <CalendarHeart className="h-8 w-8 text-pink-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-theme-text-primary">Start tracking your cycle</p>
            <p className="text-xs text-theme-text-tertiary mt-1 max-w-[240px] mx-auto">
              Log your first entry to see predictions, patterns, and a visual calendar.
            </p>
          </div>
          <button
            onClick={startEditing}
            className="mt-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-semibold px-6 py-2.5 hover:from-pink-600 hover:to-rose-600 transition-all shadow-sm active:scale-[0.98]"
          >
            Log First Entry
          </button>
        </div>
      </div>
    )
  }

  const todayMoodOpt = todayEntry ? MOOD_OPTIONS.find((m) => m.value === todayEntry.mood) : null
  const todayFlowOpt = todayEntry ? FLOW_OPTIONS.find((f) => f.value === todayEntry.flowIntensity) : null

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="mt-4 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-sm">
          <CalendarHeart className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-theme-text-primary">Cycle Tracker</h3>
          <p className="text-xs text-theme-text-tertiary mt-0.5">{subtitleText}</p>
        </div>
        {currentStreak >= 2 && (
          <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200 text-[11px] font-semibold rounded-full px-2.5 py-1">
            <Flame className="h-3 w-3 text-orange-500" />
            {currentStreak}-day streak
          </span>
        )}
      </div>

      {/* Overview Stats */}
      <div className="rounded-2xl bg-gradient-to-b from-pink-50 to-rose-50 p-5 space-y-3">
        <div className="flex items-center justify-between">
          {/* Cycle Day Ring */}
          <div className="flex flex-col items-center">
            <CycleDayRing day={currentCycleDay} total={avgCycleLength} />
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide mt-1">
              Cycle Day
            </div>
          </div>

          {/* Avg Length */}
          <div className="flex flex-col items-center border-x border-pink-200/40 px-6">
            <div className="text-2xl font-bold text-theme-text-primary">
              {avgCycleLength ? (
                <>{avgCycleLength}<span className="text-sm font-medium text-theme-text-tertiary ml-0.5">d</span></>
              ) : (
                <span className="text-base font-medium text-pink-400">--</span>
              )}
            </div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide mt-1">
              Avg Length
            </div>
            {!avgCycleLength && (
              <div className="text-[9px] text-pink-400 mt-0.5">Needs 2+ cycles</div>
            )}
          </div>

          {/* Days Until Next */}
          <div className="flex flex-col items-center">
            <div className="text-2xl font-bold text-theme-text-primary">
              {daysUntilNext !== null ? (
                daysUntilNext
              ) : (
                <span className="text-base font-medium text-pink-400">--</span>
              )}
            </div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide mt-1">
              {daysUntilNext !== null ? "Days Until" : "Next Period"}
            </div>
            {nextPeriod && (
              <div className="text-[9px] text-pink-500 font-medium mt-0.5">
                {new Date(nextPeriod + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            )}
            {!nextPeriod && !avgCycleLength && (
              <div className="text-[9px] text-pink-400 mt-0.5">Log a period start</div>
            )}
          </div>
        </div>

        {/* Today's Summary */}
        {todayEntry && !isEditing ? (
          <div className="mt-2 rounded-xl bg-white/70 backdrop-blur-sm p-3.5 space-y-2.5 border border-pink-100/60">
            <div className="flex items-center gap-2.5">
              {/* Flow pill */}
              <div
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  backgroundColor: (todayFlowOpt?.color || "#94a3b8") + "18",
                  color: todayFlowOpt?.color || "#94a3b8",
                }}
              >
                <Droplets className="h-3.5 w-3.5" />
                <span className="capitalize">{todayEntry.flowIntensity} flow</span>
              </div>

              {todayMoodOpt && <span className="text-base" title={todayMoodOpt.label}>{todayMoodOpt.emoji}</span>}

              {todayEntry.periodStart && (
                <span className="text-[10px] font-semibold text-pink-600 bg-pink-100 rounded-full px-2 py-0.5">
                  Day 1
                </span>
              )}

              <button
                onClick={startEditing}
                className="ml-auto text-xs text-pink-500 hover:text-pink-700 font-medium transition-colors"
              >
                Edit
              </button>
            </div>

            {todayEntry.symptoms.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {todayEntry.symptoms.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-pink-50 border border-pink-100 px-2 py-0.5 text-[10px] text-pink-700 font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            {todayEntry.notes && (
              <p className="text-xs text-theme-text-secondary italic">
                &quot;{todayEntry.notes}&quot;
              </p>
            )}
          </div>
        ) : !isEditing ? (
          <button
            onClick={startEditing}
            className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-semibold py-2.5 hover:from-pink-600 hover:to-rose-600 transition-all shadow-sm active:scale-[0.98] mt-2"
          >
            Log Today&apos;s Entry
          </button>
        ) : null}
      </div>

      {/* Entry Form */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING_TRANSITION}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-theme-neutral-300 bg-white p-4 space-y-5">
              {/* Flow Intensity */}
              <div>
                <label className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide block mb-2.5">
                  Flow Intensity
                </label>
                <div className="flex gap-2">
                  {FLOW_OPTIONS.map((opt) => {
                    const isSelected = selectedFlow === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setSelectedFlow(opt.value)}
                        className={`flex-1 flex flex-col items-center gap-1.5 rounded-xl py-3 transition-all border-2 ${
                          isSelected
                            ? "border-pink-400 bg-pink-50 shadow-sm scale-[1.03]"
                            : "border-transparent bg-theme-neutral-100 hover:bg-pink-50/50"
                        }`}
                      >
                        <div className="flex gap-0.5">
                          {opt.dots === 0 ? (
                            <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-300" />
                          ) : (
                            Array.from({ length: opt.dots }).map((_, i) => (
                              <div
                                key={i}
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: opt.color }}
                              />
                            ))
                          )}
                        </div>
                        <span className={`text-[11px] font-medium ${
                          isSelected ? "text-pink-700" : "text-theme-text-secondary"
                        }`}>
                          {opt.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Period Start Toggle */}
              <button
                onClick={() => setIsPeriodStart(!isPeriodStart)}
                className={`w-full flex items-center gap-3 rounded-xl p-3 transition-all border-2 ${
                  isPeriodStart
                    ? "border-pink-400 bg-pink-50"
                    : "border-theme-neutral-200 bg-white hover:border-pink-200"
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  isPeriodStart ? "border-pink-500 bg-pink-500" : "border-theme-neutral-300"
                }`}>
                  {isPeriodStart && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-theme-text-primary">First day of period</div>
                  <div className="text-[10px] text-theme-text-tertiary">This helps predict your next cycle</div>
                </div>
              </button>

              {/* Symptoms */}
              <div>
                <label className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide block mb-2.5">
                  Symptoms
                  {selectedSymptoms.length > 0 && (
                    <span className="ml-1.5 text-pink-500 normal-case tracking-normal font-medium">
                      ({selectedSymptoms.length})
                    </span>
                  )}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SYMPTOM_OPTIONS.map((symptom) => {
                    const isSelected = selectedSymptoms.includes(symptom)
                    return (
                      <button
                        key={symptom}
                        onClick={() => toggleSymptom(symptom)}
                        className={`rounded-full px-3 py-1.5 text-xs transition-all border ${
                          isSelected
                            ? "border-pink-300 bg-pink-100 text-pink-800 font-medium shadow-sm"
                            : "border-theme-neutral-200 text-theme-text-secondary hover:border-pink-200 hover:bg-pink-50/50"
                        }`}
                      >
                        {symptom}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Mood */}
              <div>
                <label className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide block mb-2.5">
                  How are you feeling?
                </label>
                <div className="flex justify-between px-2">
                  {MOOD_OPTIONS.map((opt) => {
                    const isSelected = selectedMood === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setSelectedMood(opt.value)}
                        className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all ${
                          isSelected
                            ? "bg-pink-50 shadow-sm ring-1 ring-pink-200 scale-110"
                            : "hover:bg-theme-neutral-100"
                        }`}
                      >
                        <span className={`transition-all ${isSelected ? "text-2xl" : "text-xl"}`}>
                          {opt.emoji}
                        </span>
                        <span className={`text-[9px] font-medium transition-colors ${
                          isSelected ? "text-pink-600" : "text-theme-text-tertiary"
                        }`}>
                          {opt.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide block mb-1.5">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything else you want to remember..."
                  rows={2}
                  className="w-full rounded-lg border border-theme-neutral-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-500/40 focus:border-pink-400"
                />
              </div>

              {/* Sync error */}
              {syncError && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {syncError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleSave}
                  disabled={isSyncing}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-sm"
                >
                  {isSyncing && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  {todayEntry ? "Save Changes" : "Log Entry"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                  className="text-theme-text-tertiary hover:text-theme-text-primary"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar Heatmap */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary flex items-center gap-1.5">
            <CalendarHeart className="h-3.5 w-3.5" />
            Cycle Calendar
          </span>
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="p-1 rounded-md hover:bg-theme-neutral-100 transition-colors"
          >
            {showCalendar ? (
              <ChevronUp className="h-3.5 w-3.5 text-theme-text-tertiary" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-theme-text-tertiary" />
            )}
          </button>
        </div>
        <AnimatePresence>
          {showCalendar && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING_TRANSITION}
              className="overflow-hidden"
            >
              <CycleCalendar entries={entries} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* History (Timeline) */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between w-full mb-2"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            History ({entries.length})
          </span>
          <div className="p-1 rounded-md hover:bg-theme-neutral-100 transition-colors">
            {showHistory ? (
              <ChevronUp className="h-3.5 w-3.5 text-theme-text-tertiary" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-theme-text-tertiary" />
            )}
          </div>
        </button>
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING_TRANSITION}
              className="overflow-hidden"
            >
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[13px] top-2 bottom-2 w-px bg-pink-100" />

                {entries.length === 0 ? (
                  <p className="text-xs text-theme-text-tertiary text-center py-4">
                    No entries yet
                  </p>
                ) : (
                  [...entries]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, historyLimit)
                    .map((entry) => {
                      const flowOpt = FLOW_OPTIONS.find((f) => f.value === entry.flowIntensity)
                      const moodOpt = MOOD_OPTIONS.find((m) => m.value === entry.mood)
                      return (
                        <div key={entry.date} className="flex items-start gap-3 pl-0.5 py-1.5 relative group">
                          {/* Timeline dot */}
                          <div
                            className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white flex-shrink-0"
                            style={{ backgroundColor: flowOpt?.color || "#e2e8f0" }}
                          >
                            <Droplets className="h-3 w-3 text-white" />
                          </div>

                          <div className="flex-1 min-w-0 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-theme-text-primary">
                                {new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                              {moodOpt && <span className="text-sm">{moodOpt.emoji}</span>}
                              {entry.periodStart && (
                                <span className="text-[9px] font-semibold text-pink-600 bg-pink-100 rounded-full px-1.5 py-0.5">
                                  Day 1
                                </span>
                              )}
                              <button
                                onClick={() => handleDelete(entry.date)}
                                className="ml-auto p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-theme-neutral-300 hover:text-red-500 transition-all"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                            {entry.symptoms.length > 0 && (
                              <div className="text-[10px] text-theme-text-tertiary mt-0.5">
                                {entry.symptoms.join(" \u00B7 ")}
                              </div>
                            )}
                            {entry.notes && (
                              <div className="text-[10px] text-theme-text-tertiary mt-0.5 italic truncate">
                                {entry.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                )}

                {entries.length > historyLimit && (
                  <button
                    onClick={() => setHistoryLimit((prev) => prev + 7)}
                    className="w-full text-center py-2 text-xs text-pink-500 hover:text-pink-700 font-medium transition-colors relative z-10"
                  >
                    Show more ({entries.length - historyLimit} remaining)
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
