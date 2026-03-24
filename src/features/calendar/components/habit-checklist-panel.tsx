"use client"

import { useMemo, useState, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import { Check, ChevronRight, Flame, GripVertical, Target } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useWidgets } from "@/hooks/use-widgets"
import { useToast } from "@/components/ui/use-toast"
import { getDateKey, calculateStreak, getLast7Days, buildTogglePayload, fireConfetti } from "@/lib/habit-utils"
import type { WidgetInstance } from "@/types/widgets"
import { writeNativeCalendarDragPayload } from "@/features/calendar/lib/native-calendar-dnd"

const HabitTrackerWidget = dynamic(
  () => import("@/features/widgets/components/habit-tracker-widget").then((m) => m.HabitTrackerWidget),
  { ssr: false, loading: () => <Skeleton className="h-32 w-full" /> },
)

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

function SevenDayDots({ completionHistory, schedule }: { completionHistory: string[]; schedule?: boolean[] }) {
  const days = getLast7Days()
  const completionSet = new Set(completionHistory || [])
  const today = getDateKey(new Date())

  return (
    <div className="flex gap-1">
      {days.map((key) => {
        const dow = new Date(key + "T12:00:00").getDay()
        const isScheduled = !schedule || schedule.length < 7 || schedule[dow]
        return (
          <div
            key={key}
            className={`h-2 w-2 rounded-full transition-colors ${
              completionSet.has(key)
                ? "bg-theme-secondary"
                : !isScheduled
                  ? "bg-theme-neutral-200 opacity-40"
                  : key === today
                    ? "border border-dashed border-theme-neutral-300 bg-transparent"
                    : "bg-theme-neutral-100"
            }`}
          />
        )
      })}
    </div>
  )
}

function HabitRow({
  widget,
  bucketName,
  onToggle,
  onOpen,
  isDragActive,
}: {
  widget: WidgetInstance
  bucketName: string
  onToggle: (bucketName: string, widget: WidgetInstance, isCompletedToday: boolean) => void
  onOpen: (bucketName: string, widget: WidgetInstance) => void
  isDragActive?: boolean
}) {
  const data = widget.habitTrackerData
  if (!data || !data.habitName) return null

  const today = getDateKey(new Date())
  const completionSet = new Set(data.completionHistory || [])
  const isCompletedToday = completionSet.has(today)
  const schedule = widget.schedule as boolean[] | undefined
  const streak = calculateStreak(data.completionHistory || [], schedule)

  return (
    <div
      className="group flex items-center gap-3 rounded-xl border border-theme-neutral-300 bg-white p-3 transition-all duration-200 hover:shadow-warm cursor-pointer"
      onClick={() => onOpen(bucketName, widget)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(bucketName, widget)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <button
        type="button"
        draggable
        onDragStart={(event) => {
          writeNativeCalendarDragPayload(event.dataTransfer, {
            type: "habit",
            instanceId: widget.instanceId,
            bucketName,
          })
        }}
        className={`flex-shrink-0 cursor-grab active:cursor-grabbing text-theme-text-tertiary transition-opacity ${
          isDragActive ? "opacity-100" : "opacity-30 group-hover:opacity-70"
        }`}
        onClick={(e) => e.stopPropagation()}
        title={`Drag ${data.habitName} onto a calendar day`}
      >
        <GripVertical className="h-4 w-4" />
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
          <SevenDayDots completionHistory={data.completionHistory || []} schedule={schedule} />
        </div>
      </div>

      {/* Checkbox toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle(bucketName, widget, isCompletedToday)
        }}
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
          isCompletedToday
            ? "border-theme-secondary bg-theme-secondary text-white"
            : "border-theme-neutral-300 hover:border-theme-secondary"
        }`}
        aria-label={isCompletedToday ? `Undo ${data.habitName}` : `Complete ${data.habitName}`}
      >
        {isCompletedToday && <Check className="h-3 w-3" />}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HabitChecklistPanel({ selectedDate, isDragging = false }: { selectedDate?: Date; isDragging?: boolean }) {
  const { widgetsByBucket, updateWidget, removeWidget, loading } = useWidgets()
  const { toast } = useToast()
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(new Set())
  const [openHabit, setOpenHabit] = useState<{ bucket: string; widget: WidgetInstance } | null>(null)

  // Derive habit widgets grouped by bucket, filtered by schedule for selected day
  const selectedDay = selectedDate ?? new Date()
  const dayOfWeek = selectedDay.getDay() // 0=Sun, 1=Mon, ..., 6=Sat

  const { habitsByBucket, unscheduledCount } = useMemo(() => {
    const groups: HabitsByBucket[] = []
    let hidden = 0
    for (const [bucketName, widgets] of Object.entries(widgetsByBucket)) {
      const allHabits = widgets.filter((w) => w.id === "habit_tracker" && !!w.habitTrackerData?.habitName)
      const scheduled = allHabits.filter((w) => {
        const sched = w.schedule as boolean[] | undefined
        if (sched && sched.length >= 7) return sched[dayOfWeek]
        return true
      })
      hidden += allHabits.length - scheduled.length
      if (scheduled.length > 0) {
        groups.push({ bucketName, habits: scheduled })
      }
    }
    groups.sort((a, b) => a.bucketName.localeCompare(b.bucketName))
    return { habitsByBucket: groups, unscheduledCount: hidden }
  }, [widgetsByBucket, dayOfWeek])

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
        // Fire confetti when completing (not when un-completing)
        if (!isCompletedToday) fireConfetti()
      }
    },
    [updateWidget]
  )

  const handleOpen = useCallback(
    (bucket: string, widget: WidgetInstance) => {
      setOpenHabit({ bucket, widget })
    },
    []
  )

  const handleSheetUpdate = useCallback(
    (updates: Partial<WidgetInstance>) => {
      if (!openHabit) return
      const merged = { ...openHabit.widget, ...updates }
      setOpenHabit({ bucket: openHabit.bucket, widget: merged })
      updateWidget(openHabit.bucket, openHabit.widget.instanceId, updates)
    },
    [openHabit, updateWidget]
  )

  // Ref to avoid stale closure in the async callback
  const openHabitRef = useRef(openHabit)
  openHabitRef.current = openHabit

  const handleRemoveHabit = useCallback(async () => {
    const habit = openHabitRef.current
    if (!habit) return

    const widget = habit.widget
    const bucketName = habit.bucket
    const habitName = widget.habitTrackerData?.habitName || widget.name || "Habit"

    try {
      // If no linked task exists, create one so the habit survives as a plain task
      if (!widget.linkedTaskId) {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: habitName, bucket: bucketName }),
        })
      }

      removeWidget(bucketName, widget.instanceId)
      setOpenHabit(null)
      toast({
        title: widget.linkedTaskId ? "Removed from habits" : "Converted to task",
        description: widget.linkedTaskId
          ? `"${habitName}" is no longer tracked as a habit.`
          : `"${habitName}" has been added as a task in ${bucketName}.`,
      })
    } catch (error) {
      console.error("Failed to convert habit to task:", error)
      toast({ title: "Failed to convert habit", type: "error" })
    }
  }, [removeWidget, toast])

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
          {isDragging ? "Drop a habit onto a calendar day" : "Stay on top of your goals"}
        </p>
      </div>

      <div>
        {habitsByBucket.map(({ bucketName, habits }) => {
          const isCollapsed = collapsedBuckets.has(bucketName)
          const completedCount = habits.filter((w) => {
            const today = getDateKey(new Date())
            return new Set(w.habitTrackerData?.completionHistory || []).has(today)
          }).length

          return (
            <div key={bucketName} className="space-y-2 mb-4">
              <button
                onClick={() => toggleBucketCollapse(bucketName)}
                className="flex items-center gap-2 w-full group cursor-pointer select-none"
                aria-expanded={!isCollapsed}
              >
                <div
                  className={`w-5 h-5 rounded-md bg-theme-neutral-200 flex items-center justify-center transition-transform duration-200 ${
                    isCollapsed ? "rotate-0" : "rotate-90"
                  }`}
                >
                  <ChevronRight size={12} className="text-theme-text-tertiary" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary">
                  {bucketName}
                </span>
                <span className="text-xs text-theme-text-tertiary ml-auto">
                  {completedCount}/{habits.length}
                </span>
              </button>

              <div
                className={`space-y-2 transition-all duration-300 ease-out overflow-hidden ${
                  isCollapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"
                }`}
              >
                {habits.map((widget) => (
                  <HabitRow
                    key={widget.instanceId}
                    isDragActive={isDragging}
                    widget={widget}
                    bucketName={bucketName}
                    onToggle={handleToggle}
                    onOpen={handleOpen}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Unscheduled habits indicator */}
      {unscheduledCount > 0 && (
        <p className="text-xs text-theme-text-tertiary text-center">
          {unscheduledCount} habit{unscheduledCount !== 1 ? "s" : ""} not scheduled for{" "}
          {selectedDay.toLocaleDateString("en-US", { weekday: "long" })}
        </p>
      )}

      {/* Habit detail sheet */}
      <Sheet open={!!openHabit} onOpenChange={(open) => { if (!open) setOpenHabit(null) }}>
        <SheetContent side="right" className="w-full sm:w-[480px] overflow-y-auto">
          {openHabit && (
            <>
              <SheetHeader>
                <SheetTitle className="text-theme-text-primary">
                  {openHabit.widget.habitTrackerData?.habitName || "Habit Tracker"}
                </SheetTitle>
              </SheetHeader>
              <HabitTrackerWidget
                widget={openHabit.widget}
                onUpdate={handleSheetUpdate}
                progress={{
                  value: openHabit.widget.habitTrackerData?.totalCompletions || 0,
                  streak: calculateStreak(
                    openHabit.widget.habitTrackerData?.completionHistory || [],
                    openHabit.widget.schedule as boolean[] | undefined,
                  ),
                  isToday: new Set(openHabit.widget.habitTrackerData?.completionHistory || []).has(getDateKey(new Date())),
                }}
                onComplete={() => fireConfetti()}
                onRemove={handleRemoveHabit}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
