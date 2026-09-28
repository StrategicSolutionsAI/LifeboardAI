import { useMemo } from 'react'
import { format } from 'date-fns'
import type { Task, TaskOccurrenceException } from '@/types/tasks'
import { occursOnDate } from '@/lib/task-recurrence'

export function useTaskViews(
  dailyTasks: Task[] | null | undefined,
  allTasks: Task[] | null | undefined,
  dateStr: string,
  occurrenceExceptionIndex: Map<string, Map<string, TaskOccurrenceException>>,
  applyOccurrenceAdjustments: (task: Task, occurrenceDate: string) => Task | null,
) {
  const dailyVisibleTasks = useMemo(() =>
    (dailyTasks || []).filter(t => {
      if (t.completed || t.hourSlot) return false
      const perTask = occurrenceExceptionIndex.get(t.id)
      if (perTask?.get(dateStr)?.skip) return false
      return true
    }),
    [dailyTasks, occurrenceExceptionIndex, dateStr]
  )

  const completedTasks = useMemo(() =>
    (allTasks || []).filter(t => t.completed),
    [allTasks]
  )

  const scheduledTasks = useMemo(() => {
    const targetDateStr = dateStr

    const collectFrom = (source: Task[] | null | undefined, map: Map<string, Task>) => {
      (source || []).forEach(originalTask => {
        const task = originalTask as Task
        if (!occursOnDate(task, targetDateStr)) return
        const adjusted = applyOccurrenceAdjustments(task, targetDateStr)
        if (!adjusted || !adjusted.hourSlot) return
        map.set(adjusted.id, adjusted)
      })
    }

    const taskMap = new Map<string, Task>()
    collectFrom(dailyTasks, taskMap)
    collectFrom(allTasks, taskMap)

    return Array.from(taskMap.values())
  }, [dailyTasks, allTasks, dateStr, applyOccurrenceAdjustments])

  const upcomingTasks = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')

    return (allTasks || []).filter(t => {
      if (t.completed) return false
      if (!t.due?.date) return false
      return t.due.date > todayStr
    }).sort((a, b) => {
      if (!a.due?.date || !b.due?.date) return 0
      return a.due.date.localeCompare(b.due.date)
    })
  }, [allTasks])

  return {
    dailyVisibleTasks,
    completedTasks,
    scheduledTasks,
    upcomingTasks,
  }
}
