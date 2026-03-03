"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Wind,
  Play,
  Square,
  Clock,
  TrendingUp,
  Flame,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { WidgetInstance } from "@/types/widgets"
import { motion, AnimatePresence } from "framer-motion"

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

interface BreathworkWidgetProps {
  widget: WidgetInstance
  onUpdate: (updates: Partial<WidgetInstance>) => void
  progress: { value: number; streak: number; isToday: boolean }
  onComplete: () => void
}

interface BreathPhase {
  name: "Inhale" | "Hold" | "Exhale"
  duration: number
  color: string
  prompt: string
}

interface BreathingPattern {
  name: string
  description: string
  phases: BreathPhase[]
  totalCycleSeconds: number
}

const BREATHING_PATTERNS: Record<string, BreathingPattern> = {
  "4-7-8": {
    name: "Relaxation",
    description: "Calm your mind for sleep",
    phases: [
      { name: "Inhale", duration: 4, color: "#60A5FA", prompt: "Breathe in slowly..." },
      { name: "Hold", duration: 7, color: "#A78BFA", prompt: "Hold gently..." },
      { name: "Exhale", duration: 8, color: "#34D399", prompt: "Release and let go..." },
    ],
    totalCycleSeconds: 19,
  },
  "4-4-4-4": {
    name: "Box Breathing",
    description: "Sharpen your focus",
    phases: [
      { name: "Inhale", duration: 4, color: "#60A5FA", prompt: "Breathe in deeply..." },
      { name: "Hold", duration: 4, color: "#A78BFA", prompt: "Hold steady..." },
      { name: "Exhale", duration: 4, color: "#34D399", prompt: "Slowly breathe out..." },
      { name: "Hold", duration: 4, color: "#FBBF24", prompt: "Rest and wait..." },
    ],
    totalCycleSeconds: 16,
  },
  "4-2-6": {
    name: "Energize",
    description: "Boost your energy",
    phases: [
      { name: "Inhale", duration: 4, color: "#60A5FA", prompt: "Fill your lungs..." },
      { name: "Hold", duration: 2, color: "#A78BFA", prompt: "Brief pause..." },
      { name: "Exhale", duration: 6, color: "#34D399", prompt: "Long, slow exhale..." },
    ],
    totalCycleSeconds: 12,
  },
} as const

type PatternKey = keyof typeof BREATHING_PATTERNS

const PATTERN_KEYS: PatternKey[] = ["4-7-8", "4-4-4-4", "4-2-6"]

function getDateKey(d: Date): string {
  return d.toISOString().split("T")[0]
}

function calculateStreak(history: Array<{ date: string }> | undefined): number {
  if (!history?.length) return 0
  const dates = Array.from(new Set(history.map((h) => h.date)))
    .sort()
    .reverse()

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

// ---------------------------------------------------------------------------
// Breathing Circle
// ---------------------------------------------------------------------------

function BreathingCircle({
  isRunning,
  phase,
  phaseElapsed,
  phaseColor,
}: {
  isRunning: boolean
  phase: BreathPhase | null
  phaseElapsed: number
  phaseColor: string
}) {
  const getScale = () => {
    if (!isRunning || !phase) return 0.6
    const progress = Math.min(phaseElapsed / phase.duration, 1)
    if (phase.name === "Inhale") return 0.6 + 0.4 * progress
    if (phase.name === "Exhale") return 1.0 - 0.4 * progress
    return 1.0 // Hold
  }

  const scale = getScale()

  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
      {/* Outer ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-2"
        animate={{
          borderColor: isRunning ? phaseColor : "rgba(200,200,200,0.3)",
        }}
        transition={{ duration: 0.8 }}
      />

      {/* Main breathing circle */}
      <motion.div
        className="rounded-full flex items-center justify-center backdrop-blur-sm"
        style={{ width: 180, height: 180 }}
        animate={{
          scale,
          backgroundColor: isRunning
            ? `${phaseColor}20`
            : "rgba(200,200,200,0.1)",
          boxShadow: isRunning
            ? `0 0 40px ${phaseColor}30, inset 0 0 30px ${phaseColor}10`
            : "0 0 0 transparent",
        }}
        transition={{
          scale: { duration: 1, ease: "easeInOut" },
          backgroundColor: { duration: 0.8 },
          boxShadow: { duration: 0.8 },
        }}
      >
        <div className="text-center">
          {isRunning && phase ? (
            <>
              <motion.div
                className="text-lg font-semibold"
                animate={{ color: phaseColor }}
                transition={{ duration: 0.5 }}
              >
                {phase.name}
              </motion.div>
              <div className="text-3xl font-bold tabular-nums text-theme-text-primary mt-0.5">
                {Math.max(Math.ceil(phase.duration - phaseElapsed), 0)}
              </div>
            </>
          ) : (
            <>
              <Wind className="h-8 w-8 mx-auto text-theme-neutral-300 mb-1" />
              <div className="text-sm text-theme-text-tertiary">Ready</div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pattern Selector
// ---------------------------------------------------------------------------

function PatternSelector({
  selected,
  onSelect,
  disabled,
}: {
  selected: PatternKey
  onSelect: (key: PatternKey) => void
  disabled: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {PATTERN_KEYS.map((key) => {
        const pattern = BREATHING_PATTERNS[key]
        const isSelected = selected === key
        return (
          <motion.button
            key={key}
            whileTap={!disabled ? { scale: 0.97 } : undefined}
            onClick={() => !disabled && onSelect(key)}
            disabled={disabled}
            className={`rounded-xl border p-3 text-left transition-all ${
              isSelected
                ? "border-indigo-400 bg-indigo-50 shadow-sm"
                : disabled
                  ? "border-theme-neutral-200 bg-theme-neutral-50 opacity-50 cursor-not-allowed"
                  : "border-theme-neutral-200 bg-white hover:border-theme-neutral-300"
            }`}
          >
            <div className={`text-sm font-semibold ${isSelected ? "text-indigo-700" : "text-theme-text-primary"}`}>
              {pattern.name}
            </div>
            <div className="text-[10px] text-theme-text-tertiary mt-0.5">{pattern.description}</div>
            <div className={`text-xs mt-1 font-mono ${isSelected ? "text-indigo-500" : "text-theme-text-subtle"}`}>
              {key}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BreathworkWidget({
  widget,
  onUpdate,
  onComplete,
}: BreathworkWidgetProps) {
  const data = widget.breathworkData
  const today = getDateKey(new Date())

  // Session state
  const [isRunning, setIsRunning] = useState(false)
  const [selectedPattern, setSelectedPattern] = useState<PatternKey>(
    (data?.preferredPattern as PatternKey) || "4-7-8"
  )
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [phaseElapsed, setPhaseElapsed] = useState(0)
  const [cyclesCompleted, setCyclesCompleted] = useState(0)
  const [sessionElapsed, setSessionElapsed] = useState(0)
  const [showHistory, setShowHistory] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionStartRef = useRef<number>(0)

  const pattern = BREATHING_PATTERNS[selectedPattern]
  const currentPhase = pattern.phases[phaseIndex] || pattern.phases[0]

  // Stats
  const totalSessions = data?.totalSessions || 0
  const totalMinutes = data?.totalMinutes || 0
  const sessionHistory = data?.sessionHistory || []
  const currentStreak = useMemo(() => calculateStreak(sessionHistory), [sessionHistory])
  const bestStreak = Math.max(data?.bestStreak || 0, currentStreak)

  // Timer logic
  useEffect(() => {
    if (!isRunning) return

    intervalRef.current = setInterval(() => {
      setPhaseElapsed((prev) => {
        const next = prev + 0.25 // 250ms ticks
        const currentPhaseObj = pattern.phases[phaseIndex]

        if (next >= currentPhaseObj.duration) {
          // Advance to next phase
          const nextPhaseIndex = (phaseIndex + 1) % pattern.phases.length

          if (nextPhaseIndex === 0) {
            // Completed a full cycle
            setCyclesCompleted((c) => c + 1)
          }

          setPhaseIndex(nextPhaseIndex)
          return 0
        }

        return next
      })

      setSessionElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000))
    }, 250)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, phaseIndex, pattern.phases])

  // Handlers
  const handleStart = useCallback(() => {
    sessionStartRef.current = Date.now()
    setPhaseIndex(0)
    setPhaseElapsed(0)
    setCyclesCompleted(0)
    setSessionElapsed(0)
    setIsRunning(true)

    onUpdate({
      breathworkData: {
        ...data,
        isActive: true,
        currentPattern: selectedPattern,
      },
    })
  }, [data, selectedPattern, onUpdate])

  const handleStop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setIsRunning(false)

    const sessionMinutes = Math.max(1, Math.round(sessionElapsed / 60))
    const newHistory = [
      ...(data?.sessionHistory || []),
      {
        date: today,
        pattern: selectedPattern,
        cycles: cyclesCompleted,
        duration: sessionMinutes,
      },
    ]
    const newStreak = calculateStreak(newHistory)

    onUpdate({
      breathworkData: {
        ...data,
        isActive: false,
        currentPattern: selectedPattern,
        cyclesCompleted: (data?.cyclesCompleted || 0) + cyclesCompleted,
        totalSessions: (data?.totalSessions || 0) + 1,
        totalMinutes: (data?.totalMinutes || 0) + sessionMinutes,
        lastSessionDate: today,
        sessionHistory: newHistory,
        preferredPattern: selectedPattern,
        currentStreak: newStreak,
        bestStreak: Math.max(data?.bestStreak || 0, newStreak),
      },
    })

    if (cyclesCompleted >= 1) {
      onComplete()
    }

    // Reset local state
    setPhaseIndex(0)
    setPhaseElapsed(0)
    setCyclesCompleted(0)
    setSessionElapsed(0)
  }, [data, today, selectedPattern, cyclesCompleted, sessionElapsed, onUpdate, onComplete])

  // Format session elapsed as mm:ss
  const sessionTimeDisplay = useMemo(() => {
    const m = Math.floor(sessionElapsed / 60)
    const s = sessionElapsed % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }, [sessionElapsed])

  // Group history by date
  const historyByDate = useMemo(() => {
    const grouped: Record<string, Array<{ pattern: string; cycles: number; duration: number }>> = {}
    for (const s of sessionHistory) {
      if (!grouped[s.date]) grouped[s.date] = []
      grouped[s.date].push(s)
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 7)
  }, [sessionHistory])

  const patternDisplayName: Record<string, string> = {
    "4-7-8": "Relaxation",
    "4-4-4-4": "Box Breathing",
    "4-2-6": "Energize",
  }

  return (
    <div className="mt-4 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
          <Wind className="h-5 w-5 text-teal-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-theme-text-primary">Breathwork</h3>
          <p className="text-xs text-theme-text-tertiary mt-0.5">
            {totalSessions} sessions &middot; {totalMinutes} total minutes
          </p>
        </div>
        {currentStreak >= 2 && (
          <Badge variant="secondary" className="gap-1">
            <Flame className="h-3 w-3 text-orange-500" />
            {currentStreak} days
          </Badge>
        )}
      </div>

      {/* Pattern Selector */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-2">
          Breathing Pattern
        </h4>
        <PatternSelector
          selected={selectedPattern}
          onSelect={setSelectedPattern}
          disabled={isRunning}
        />
      </div>

      {/* Breathing Circle */}
      <div
        className={`rounded-2xl p-6 transition-colors duration-700 ${
          isRunning
            ? "bg-gradient-to-b from-teal-50 to-blue-50"
            : "bg-theme-surface-alt"
        }`}
      >
        <div className="flex justify-center">
          <BreathingCircle
            isRunning={isRunning}
            phase={isRunning ? currentPhase : null}
            phaseElapsed={phaseElapsed}
            phaseColor={currentPhase.color}
          />
        </div>

        {/* Guided prompt */}
        <AnimatePresence mode="wait">
          {isRunning && (
            <motion.p
              key={currentPhase.prompt}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              className="text-center text-sm mt-3 italic"
              style={{ color: currentPhase.color }}
            >
              {currentPhase.prompt}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Session info bar */}
        {isRunning && (
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-theme-text-tertiary">
            <div className="text-center">
              <motion.div
                key={cyclesCompleted}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="text-lg font-bold text-theme-text-primary"
              >
                {cyclesCompleted}
              </motion.div>
              <div>cycles</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold tabular-nums text-theme-text-primary">
                {sessionTimeDisplay}
              </div>
              <div>elapsed</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-theme-text-secondary">
                {patternDisplayName[selectedPattern]}
              </div>
              <div>pattern</div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 mt-4">
          {!isRunning ? (
            <Button
              onClick={handleStart}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 px-6"
              size="lg"
            >
              <Play className="h-5 w-5" />
              Begin
            </Button>
          ) : (
            <Button
              onClick={handleStop}
              variant="outline"
              className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
            >
              <Square className="h-4 w-4" />
              End Session
            </Button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Stats
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">{totalSessions}</div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">
              Sessions
            </div>
          </div>
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">{totalMinutes}</div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">
              Total Minutes
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

      {/* Session History */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary hover:text-theme-text-secondary transition-colors w-full"
        >
          <Clock className="h-3.5 w-3.5" />
          Session History ({sessionHistory.length})
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
                {historyByDate.length === 0 ? (
                  <p className="text-xs text-theme-text-tertiary text-center py-4">
                    No sessions yet. Start your first breathwork!
                  </p>
                ) : (
                  historyByDate.map(([date, sessions]) => (
                    <div
                      key={date}
                      className="rounded-lg border border-theme-neutral-200 bg-white p-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-theme-text-primary">
                          {date === today
                            ? "Today"
                            : new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                        </span>
                        <span className="text-theme-text-tertiary">
                          {sessions.length} session{sessions.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {sessions.map((s, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-medium"
                          >
                            {patternDisplayName[s.pattern] || s.pattern} &middot; {s.cycles} cycles
                          </span>
                        ))}
                      </div>
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
