"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Brain,
  Play,
  Pause,
  RotateCcw,
  Clock,
  TrendingUp,
  Flame,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { WidgetInstance } from "@/types/widgets"
import { motion, AnimatePresence } from "framer-motion"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MeditationTimerWidgetProps {
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

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

function calculateStreak(
  history: Array<{ date: string }> | undefined,
  lastSessionDate: string | undefined
): number {
  if (!history?.length && !lastSessionDate) return 0
  const dates = Array.from(
    new Set([
      ...(history?.map((h) => h.date) ?? []),
      ...(lastSessionDate ? [lastSessionDate] : []),
    ])
  )
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

const DURATION_PRESETS = [5, 10, 15, 20, 30] // minutes

// ---------------------------------------------------------------------------
// Circular Progress
// ---------------------------------------------------------------------------

function CircularProgress({
  elapsed,
  total,
  isRunning,
  isPaused,
}: {
  elapsed: number
  total: number
  isRunning: boolean
  isPaused: boolean
}) {
  const radius = 90
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(elapsed / total, 1)
  const dashOffset = circumference * (1 - progress)
  const remaining = Math.max(total - elapsed, 0)

  // Color transitions from blue to green as progress increases
  const hue = 200 + progress * 60 // 200 (blue) -> 260 (purple) as a nice progression
  // Actually let's go blue to emerald
  const strokeColor = progress >= 1 ? "#10b981" : progress > 0.5 ? "#6366f1" : "#3b82f6"

  return (
    <div className="relative flex items-center justify-center">
      <svg width="220" height="220" className="-rotate-90">
        {/* Track */}
        <circle
          cx="110"
          cy="110"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-theme-neutral-200"
        />
        {/* Progress */}
        <motion.circle
          cx="110"
          cy="110"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-4xl font-bold tabular-nums text-theme-text-primary"
          animate={isPaused ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
          transition={isPaused ? { duration: 1.5, repeat: Infinity } : {}}
        >
          {formatTime(remaining)}
        </motion.span>
        <span className="text-xs text-theme-text-tertiary mt-1">
          {!isRunning
            ? "Ready"
            : isPaused
              ? "Paused"
              : progress >= 1
                ? "Complete!"
                : "remaining"}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Duration Selector
// ---------------------------------------------------------------------------

function DurationSelector({
  selected,
  onSelect,
  disabled,
}: {
  selected: number
  onSelect: (minutes: number) => void
  disabled: boolean
}) {
  return (
    <div className="flex gap-2 justify-center flex-wrap">
      {DURATION_PRESETS.map((mins) => (
        <motion.button
          key={mins}
          whileTap={!disabled ? { scale: 0.95 } : undefined}
          onClick={() => !disabled && onSelect(mins)}
          disabled={disabled}
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
            selected === mins
              ? "bg-indigo-600 text-white shadow-md"
              : disabled
                ? "bg-theme-neutral-100 text-theme-neutral-300 cursor-not-allowed"
                : "bg-theme-neutral-100 text-theme-text-secondary hover:bg-theme-neutral-200"
          }`}
        >
          {mins}m
        </motion.button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MeditationTimerWidget({
  widget,
  onUpdate,
  onComplete,
}: MeditationTimerWidgetProps) {
  const data = widget.meditationData
  const today = getDateKey(new Date())

  // Timer state
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [selectedMinutes, setSelectedMinutes] = useState(
    data?.preferredDuration || 10
  )
  const [showCelebration, setShowCelebration] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const elapsedBeforePauseRef = useRef<number>(0)

  const selectedDuration = selectedMinutes * 60 // seconds

  // Stats
  const totalSessions = data?.completedSessions || 0
  const totalMinutes = data?.totalMinutes || 0
  const sessionHistory = data?.sessionHistory || []
  const currentStreak = useMemo(
    () => calculateStreak(sessionHistory, data?.lastSessionDate),
    [sessionHistory, data?.lastSessionDate]
  )
  const bestStreak = Math.max(data?.bestStreak || 0, currentStreak)

  // Restore active session on mount
  useEffect(() => {
    if (data?.isActive && data?.startTime && !isRunning) {
      const savedElapsed = data.elapsedBeforePause || 0
      if (!data.isPaused) {
        const realElapsed =
          Math.floor((Date.now() - data.startTime) / 1000) + savedElapsed
        if (realElapsed < (data.duration || selectedDuration)) {
          setElapsed(realElapsed)
          startTimeRef.current = data.startTime
          elapsedBeforePauseRef.current = savedElapsed
          setIsRunning(true)
        }
      } else {
        setElapsed(savedElapsed)
        elapsedBeforePauseRef.current = savedElapsed
        setIsRunning(true)
        setIsPaused(true)
      }
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Timer interval
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        const now = Date.now()
        const newElapsed =
          Math.floor((now - startTimeRef.current) / 1000) +
          elapsedBeforePauseRef.current
        setElapsed(newElapsed)

        if (newElapsed >= selectedDuration) {
          // Session complete
          if (intervalRef.current) clearInterval(intervalRef.current)
          handleSessionComplete(newElapsed)
        }
      }, 250) // Update 4x/sec for smooth display
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, isPaused, selectedDuration])

  // Handlers
  const handleStart = useCallback(() => {
    startTimeRef.current = Date.now()
    elapsedBeforePauseRef.current = 0
    setElapsed(0)
    setIsRunning(true)
    setIsPaused(false)
    setShowCelebration(false)

    onUpdate({
      meditationData: {
        ...data,
        isActive: true,
        startTime: Date.now(),
        duration: selectedDuration,
        isPaused: false,
        elapsedBeforePause: 0,
      },
    })
  }, [data, selectedDuration, onUpdate])

  const handlePause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setIsPaused(true)
    elapsedBeforePauseRef.current = elapsed

    onUpdate({
      meditationData: {
        ...data,
        isPaused: true,
        elapsedBeforePause: elapsed,
      },
    })
  }, [data, elapsed, onUpdate])

  const handleResume = useCallback(() => {
    startTimeRef.current = Date.now()
    setIsPaused(false)

    onUpdate({
      meditationData: {
        ...data,
        isPaused: false,
        startTime: Date.now(),
        elapsedBeforePause: elapsedBeforePauseRef.current,
      },
    })
  }, [data, onUpdate])

  const handleReset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setIsRunning(false)
    setIsPaused(false)
    setElapsed(0)
    setShowCelebration(false)
    startTimeRef.current = 0
    elapsedBeforePauseRef.current = 0

    onUpdate({
      meditationData: {
        ...data,
        isActive: false,
        isPaused: false,
        startTime: undefined,
        elapsedBeforePause: 0,
      },
    })
  }, [data, onUpdate])

  const handleSessionComplete = useCallback(
    (finalElapsed: number) => {
      setIsRunning(false)
      setIsPaused(false)
      setShowCelebration(true)

      const sessionMinutes = Math.round(finalElapsed / 60)
      const newHistory = [
        ...(data?.sessionHistory || []),
        {
          date: today,
          duration: sessionMinutes,
          completedAt: new Date().toISOString(),
        },
      ]
      const newStreak = calculateStreak(newHistory, today)

      onUpdate({
        meditationData: {
          ...data,
          isActive: false,
          isPaused: false,
          completedSessions: (data?.completedSessions || 0) + 1,
          totalMinutes: (data?.totalMinutes || 0) + sessionMinutes,
          completedToday: true,
          lastSessionDate: today,
          sessionHistory: newHistory,
          preferredDuration: selectedMinutes,
          currentStreak: newStreak,
          bestStreak: Math.max(data?.bestStreak || 0, newStreak),
        },
      })

      onComplete()

      // Auto-hide celebration
      setTimeout(() => setShowCelebration(false), 4000)
    },
    [data, today, selectedMinutes, onUpdate, onComplete]
  )

  // Group history by date for display
  const historyByDate = useMemo(() => {
    const grouped: Record<string, Array<{ duration: number; completedAt: string }>> = {}
    for (const s of sessionHistory) {
      if (!grouped[s.date]) grouped[s.date] = []
      grouped[s.date].push(s)
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 7)
  }, [sessionHistory])

  return (
    <div className="mt-4 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
          <Brain className="h-5 w-5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-theme-text-primary">Meditation</h3>
          <p className="text-xs text-theme-text-tertiary mt-0.5">
            {totalMinutes} total minutes across {totalSessions} sessions
          </p>
        </div>
        {currentStreak >= 2 && (
          <Badge variant="secondary" className="gap-1">
            <Flame className="h-3 w-3 text-orange-500" />
            {currentStreak} days
          </Badge>
        )}
      </div>

      {/* Timer Section */}
      <div
        className={`rounded-2xl p-6 transition-colors duration-700 ${
          isRunning && !isPaused
            ? "bg-gradient-to-b from-indigo-50 to-violet-50"
            : "bg-theme-surface-alt"
        }`}
      >
        <div className="flex justify-center">
          <CircularProgress
            elapsed={elapsed}
            total={selectedDuration}
            isRunning={isRunning}
            isPaused={isPaused}
          />
        </div>

        {/* Ambient text */}
        <AnimatePresence mode="wait">
          {isRunning && !isPaused && !showCelebration && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center text-sm text-theme-text-tertiary mt-3 italic"
            >
              Breathe and relax...
            </motion.p>
          )}
        </AnimatePresence>

        {/* Celebration */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="flex flex-col items-center mt-4"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                <Check className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-theme-text-primary">Session complete!</p>
              <p className="text-xs text-theme-text-tertiary mt-0.5">
                {selectedMinutes} minutes of mindfulness
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 mt-4">
          {!isRunning ? (
            <Button
              onClick={handleStart}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 px-6"
              size="lg"
            >
              <Play className="h-5 w-5" />
              Start
            </Button>
          ) : (
            <>
              {isPaused ? (
                <Button
                  onClick={handleResume}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                  <Play className="h-4 w-4" />
                  Resume
                </Button>
              ) : (
                <Button
                  onClick={handlePause}
                  variant="outline"
                  className="gap-1.5 border-amber-300 text-theme-text-primary hover:bg-amber-50"
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              )}
              <Button onClick={handleReset} variant="ghost" className="gap-1.5 text-theme-text-tertiary">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Duration Presets */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-2 text-center">
          Duration
        </h4>
        <DurationSelector
          selected={selectedMinutes}
          onSelect={setSelectedMinutes}
          disabled={isRunning}
        />
      </div>

      {/* Stats Grid */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Stats
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">{totalMinutes}</div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">
              Total Minutes
            </div>
          </div>
          <div className="rounded-lg border border-theme-neutral-300 bg-white p-3 text-center">
            <div className="text-xl font-bold text-theme-text-primary">{totalSessions}</div>
            <div className="text-[10px] text-theme-text-tertiary uppercase tracking-wide">
              Sessions
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
                    No sessions yet. Start your first meditation!
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
                          {sessions.length} session{sessions.length > 1 ? "s" : ""} &middot;{" "}
                          {sessions.reduce((s, v) => s + v.duration, 0)} min
                        </span>
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
