"use client"

import { format } from "date-fns"
import { CalendarPlus, Repeat } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { WidgetInstance } from "@/types/widgets"
import type { RepeatOption } from "@/types/tasks"

// ---------------------------------------------------------------------------
// Derive a RepeatOption from a habit's boolean[] schedule
// ---------------------------------------------------------------------------

export function deriveRepeatRule(schedule?: boolean[]): RepeatOption {
  if (!schedule || schedule.length < 7) return "daily"

  const activeDays = schedule.filter(Boolean).length
  if (activeDays === 7) return "daily"
  if (activeDays === 5 && !schedule[0] && !schedule[6]) return "weekdays"
  if (activeDays === 1) return "weekly"
  // For other patterns, weekly is the safest default
  return "weekly"
}

export function scheduleLabel(schedule?: boolean[]): string {
  if (!schedule || schedule.length < 7) return "Daily"

  const activeDays = schedule.filter(Boolean).length
  if (activeDays === 7) return "Daily"
  if (activeDays === 5 && !schedule[0] && !schedule[6]) return "Weekdays"
  if (activeDays === 1) {
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const idx = schedule.findIndex(Boolean)
    return `Weekly (${DAYS[idx]})`
  }

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const names = schedule.map((on, i) => (on ? DAYS[i] : null)).filter(Boolean)
  return `Weekly (${names.join(", ")})`
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

export type HabitScheduleMode = "once" | "repeat"

interface HabitScheduleDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (mode: HabitScheduleMode) => void
  widget: WidgetInstance
  targetDate: string // yyyy-MM-dd
  isCreating: boolean
}

export function HabitScheduleDialog({
  open,
  onClose,
  onConfirm,
  widget,
  targetDate,
  isCreating,
}: HabitScheduleDialogProps) {
  const habitName = widget.habitTrackerData?.habitName ?? widget.name ?? "Habit"
  const schedule = widget.schedule as boolean[] | undefined
  const repeatLabel = scheduleLabel(schedule)
  const dateLabel = format(new Date(targetDate + "T12:00:00"), "MMM d")

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Create task from habit</DialogTitle>
          <DialogDescription>
            Add &ldquo;{habitName}&rdquo; as a task on your calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          <Button
            variant="outline"
            className="justify-start gap-3 h-auto py-3 px-4"
            disabled={isCreating}
            onClick={() => onConfirm("once")}
          >
            <CalendarPlus className="h-4 w-4 flex-shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium">Just {dateLabel}</p>
              <p className="text-xs text-theme-text-tertiary">One-time task</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-3 h-auto py-3 px-4"
            disabled={isCreating}
            onClick={() => onConfirm("repeat")}
          >
            <Repeat className="h-4 w-4 flex-shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium">Repeat: {repeatLabel}</p>
              <p className="text-xs text-theme-text-tertiary">Recurring task matching habit schedule</p>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
