"use client"

import { useMemo, useState, useCallback } from "react"
import { Check, ChevronRight, Flame, Target } from "lucide-react"
import { useWidgets } from "@/hooks/use-widgets"
import { getDateKey, calculateStreak, getLast7Days, buildTogglePayload } from "@/lib/habit-utils"
import type { WidgetInstance } from "@/types/widgets"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HabitsByBucket {
  bucketName: string
  habits: WidgetInstance[]
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SevenDayDots({ completionHistory }: { completionHistory: string[] }) {
  const days = getLast7Days()
  const completionSet = new Set(completionHistory || [])
  const today = getDateKey(new Date())

  return (
    <div className="flex gap-1">
      {days.map((key) => (
        <div
          key={key}
          className={`h-2 w-2 rounded-full transition-colors ${
            completionSet.has(key)
              ? "bg-theme-secondary"
              : key === today
                ? "border border-dashed border-theme-neutral-300 bg-transparent"
                : "bg-theme-neutral-100"
          }`}
        />
      ))}
    </div>
  )
}

function HabitRow({
  widget,
  bucketName,
  onToggle,
}: {
  widget: WidgetInstance
  bucketName: string
  onToggle: (bucketName: string, widget: WidgetInstance, isCompletedToday: boolean) => void
}) {
  const data = widget.habitTrackerData
  if (!data || !data.habitName) return null

  const today = getDateKey(new Date())
  const completionSet = new Set(data.completionHistory || [])
  const isCompletedToday = completionSet.has(today)
  const streak = calculateStreak(data.completionHistory || [])

  return (
    <div className="flex items-center gap-3 rounded-xl border border-theme-neutral-300 bg-white p-3 transition-all duration-200 hover:shadow-warm">
      {/* Check circle toggle */}
      <button
        onClick={() => onToggle(bucketName, widget, isCompletedToday)}
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
          isCompletedToday
            ? "border-theme-secondary bg-theme-secondary text-white"
            : "border-theme-neutral-300 hover:border-theme-secondary"
        }`}
        aria-label={isCompletedToday ? `Undo ${data.habitName}` : `Complete ${data.habitName}`}
      >
        {isCompletedToday && <Check className="h-3.5 w-3.5" />}
      </button>

      {/* Habit info */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium leading-tight transition-all duration-200 ${
            isCompletedToday
              ? "line-through text-theme-text-tertiary/70"
              : "text-theme-text-primary"
          }`}
        >
          {data.habitName}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {streak > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-theme-text-tertiary">
              <Flame className="h-3 w-3 text-orange-500" />
              {streak} day{streak !== 1 ? "s" : ""}
            </span>
          )}
          <SevenDayDots completionHistory={data.completionHistory || []} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HabitChecklistPanel({ selectedDate }: { selectedDate?: Date }) {
  const { widgetsByBucket, updateWidget, loading } = useWidgets()
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(new Set())

  // Derive habit widgets grouped by bucket, filtered by schedule for selected day
  const habitsByBucket: HabitsByBucket[] = useMemo(() => {
    const dayOfWeek = (selectedDate ?? new Date()).getDay() // 0=Sun, 1=Mon, ..., 6=Sat
    const groups: HabitsByBucket[] = []
    for (const [bucketName, widgets] of Object.entries(widgetsByBucket)) {
      const habits = widgets.filter((w) => {
        if (w.id !== "habit_tracker" || !w.habitTrackerData?.habitName) return false
        // If schedule exists, only show habit on scheduled days
        const schedule = w.schedule as boolean[] | undefined
        if (schedule && schedule.length >= 7) {
          return schedule[dayOfWeek]
        }
        // No schedule set (or all days) → always show
        return true
      })
      if (habits.length > 0) {
        groups.push({ bucketName, habits })
      }
    }
    // Sort buckets alphabetically for stable ordering
    groups.sort((a, b) => a.bucketName.localeCompare(b.bucketName))
    return groups
  }, [widgetsByBucket, selectedDate])

  const toggleBucketCollapse = useCallback((bucket: string) => {
    setCollapsedBuckets((prev) => {
      const next = new Set(prev)
      if (next.has(bucket)) {
        next.delete(bucket)
      } else {
        next.add(bucket)
      }
      return next
    })
  }, [])

  const handleToggle = useCallback(
    (bucketName: string, widget: WidgetInstance, isCompletedToday: boolean) => {
      const payload = buildTogglePayload(widget, isCompletedToday)
      if (payload) {
        updateWidget(bucketName, widget.instanceId, payload)
      }
    },
    [updateWidget]
  )

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-theme-skeleton h-16 rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  // Empty state
  if (habitsByBucket.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-xl bg-theme-surface-selected flex items-center justify-center mx-auto mb-3">
          <Target className="h-5 w-5 text-theme-text-tertiary" />
        </div>
        <h5 className="text-sm font-medium text-theme-text-primary mb-1">
          No habits yet
        </h5>
        <p className="text-xs text-theme-text-tertiary max-w-[220px] mx-auto">
          Add a Habit Tracker widget to any bucket on your dashboard to see it here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 py-2">
      {/* Header */}
      <div>
        <h4 className="section-label">Daily Habit Tracker</h4>
        <p className="text-xs text-theme-text-tertiary mt-0.5">
          Stay on top of your goals
        </p>
      </div>

      {/* Bucket sections */}
      {habitsByBucket.map(({ bucketName, habits }) => {
        const isCollapsed = collapsedBuckets.has(bucketName)
        const completedCount = habits.filter((w) => {
          const today = getDateKey(new Date())
          return new Set(w.habitTrackerData?.completionHistory || []).has(today)
        }).length

        return (
          <div key={bucketName} className="space-y-2">
            {/* Bucket category header */}
            <button
              onClick={() => toggleBucketCollapse(bucketName)}
              className="flex items-center gap-2 w-full group cursor-pointer select-none"
            >
              <div
                className={`w-5 h-5 rounded-md bg-theme-secondary flex items-center justify-center transition-transform duration-200 ${
                  isCollapsed ? "rotate-0" : "rotate-90"
                }`}
              >
                <ChevronRight size={12} className="text-white" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary">
                {bucketName}
              </span>
              <span className="text-xs text-theme-text-tertiary ml-auto">
                {completedCount}/{habits.length}
              </span>
            </button>

            {/* Habit rows */}
            <div
              className={`space-y-2 transition-all duration-300 ease-out overflow-hidden ${
                isCollapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"
              }`}
            >
              {habits.map((widget) => (
                <HabitRow
                  key={widget.instanceId}
                  widget={widget}
                  bucketName={bucketName}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
