import { addDays } from 'date-fns'
import type { Task, TaskOccurrenceException } from '@/types/tasks'
import { dateStr } from '@/lib/date-utils'
import { occursOnDate } from '@/lib/task-recurrence'
import { hourSlotMinutes } from '@/lib/reminders/due-reminders'
import { DEFAULT_TASK_MINUTES, HEAVY_DAY_HOURS } from '@/lib/capacity'

// What belongs on "Today": the tasks due or repeating today, grouped the way
// Apple Reminders and Things do (morning / afternoon / evening, then anytime),
// with overdue work kept separate so it can be rescheduled in one move rather
// than silently piling into today. Pure — `day` and `today` are client-local
// keys. The calendar plans whichever day is selected; only the real today
// carries anything over.

export type DayPart = 'morning' | 'afternoon' | 'evening'
export const DAY_PARTS: DayPart[] = ['morning', 'afternoon', 'evening']

export type ExceptionIndex = Map<string, Map<string, TaskOccurrenceException>>

export interface TodayPlan {
  overdue: Task[]
  timed: Record<DayPart, Task[]>
  anytime: Task[]
  /** Finished today: completed tasks, plus repeating tasks whose occurrence today is done. */
  done: Task[]
  suggestions: { tomorrow: Task[]; thisWeek: Task[]; someday: Task[] }
  openCount: number
  plannedMinutes: number
  heavy: boolean
}

/** Repeats by a rule we can expand day by day. */
export const isRepeating = (task: Task) => Boolean(task.repeatRule)
/** Repeats in any system — including Todoist rules we can't expand — so never "late". */
export const isRecurring = (task: Task) => Boolean(task.repeatRule || task.due?.is_recurring)
/**
 * Checking it off finishes today's occurrence (a local exception). Todoist
 * repeats close through Todoist instead, which advances them itself.
 */
export const completesPerOccurrence = (task: Task) => isRepeating(task) && task.source !== 'todoist'

/** Minutes after midnight the task starts, or null for an untimed task. */
export const startMinutes = (task: Task) => hourSlotMinutes(task.hourSlot)

export function dayPartOf(minutes: number): DayPart {
  if (minutes < 12 * 60) return 'morning'
  if (minutes < 17 * 60) return 'afternoon'
  return 'evening'
}

const shiftKey = (key: string, days: number) => dateStr(addDays(new Date(`${key}T00:00:00`), days))

function localDayOf(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : dateStr(d)
}

// Today's occurrence of a repeating task with its per-day overrides applied.
// Unlike the planner, an occurrence taken off the timeline (override slot
// cleared) still belongs to the day — it just has no time.
function occurrenceForToday(task: Task, exception: TaskOccurrenceException | undefined): Task {
  if (!exception) return task
  const next = { ...task }
  if (exception.overrideHourSlot !== undefined) next.hourSlot = exception.overrideHourSlot || undefined
  if (exception.overrideDuration != null) next.duration = exception.overrideDuration
  if (exception.overrideBucket) next.bucket = exception.overrideBucket
  return next
}

const byContent = (a: Task, b: Task) => a.content.localeCompare(b.content)

export function buildTodayPlan(
  tasks: Task[],
  day: string,
  exceptions: ExceptionIndex = new Map(),
  today: string = day,
): TodayPlan {
  const carriesOver = day === today
  const tomorrow = shiftKey(day, 1)
  const weekEnd = shiftKey(day, 7)
  const overdue: Task[] = []
  const timed: Record<DayPart, Task[]> = { morning: [], afternoon: [], evening: [] }
  const anytime: Task[] = []
  const done: Task[] = []
  const suggestions = { tomorrow: [] as Task[], thisWeek: [] as Task[], someday: [] as Task[] }
  const seen = new Set<string>()

  const place = (task: Task) => {
    const minutes = startMinutes(task)
    if (minutes === null) anytime.push(task)
    else timed[dayPartOf(minutes)].push(task)
  }

  for (const task of tasks) {
    if (seen.has(task.id)) continue
    seen.add(task.id)
    const due = task.due?.date

    if (task.completed) {
      if (due === day || localDayOf(task.updated_at) === day) done.push(task)
      continue
    }

    if (isRepeating(task)) {
      if (!due || !occursOnDate(task, day)) continue
      const exception = exceptions.get(task.id)?.get(day)
      if (exception?.skip) done.push(task)
      else place(occurrenceForToday(task, exception))
      continue
    }

    // A Todoist repeat we can't expand: its date is the next occurrence.
    if (task.due?.is_recurring) {
      if (due === day || (carriesOver && due && due < day)) place(task)
      continue
    }

    if (!due) {
      suggestions.someday.push(task)
    } else if (due === day) {
      place(task)
    } else if (due < day) {
      // A multi-day task that started earlier is still in progress, not late.
      if (task.endDate && task.endDate >= day) place(task)
      else if (carriesOver) overdue.push(task)
    } else if (due === tomorrow) {
      suggestions.tomorrow.push(task)
    } else if (due <= weekEnd) {
      suggestions.thisWeek.push(task)
    }
  }

  for (const part of DAY_PARTS) timed[part].sort((a, b) => (startMinutes(a) ?? 0) - (startMinutes(b) ?? 0))
  anytime.sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || byContent(a, b))
  overdue.sort((a, b) => (a.due?.date ?? '').localeCompare(b.due?.date ?? '') || byContent(a, b))
  suggestions.thisWeek.sort((a, b) => (a.due?.date ?? '').localeCompare(b.due?.date ?? '') || byContent(a, b))
  suggestions.someday.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  done.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))

  const open = [...DAY_PARTS.flatMap((part) => timed[part]), ...anytime]
  // A timed task with no length counts as an hour, as in the assistant's
  // capacity read; an untimed task counts only when it has a length.
  const plannedMinutes = open.reduce((sum, task) => {
    if (task.duration && task.duration > 0) return sum + task.duration
    return startMinutes(task) === null ? sum : sum + DEFAULT_TASK_MINUTES
  }, 0)

  return {
    overdue,
    timed,
    anytime,
    done,
    suggestions,
    openCount: open.length,
    plannedMinutes,
    heavy: plannedMinutes >= HEAVY_DAY_HOURS * 60,
  }
}
