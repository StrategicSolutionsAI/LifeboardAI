import { useMemo } from 'react'
import { format } from 'date-fns'
import type { Task, TaskOccurrenceException } from '@/types/tasks'

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

    const occursOnDate = (task: Task, todayStr: string) => {
      if (!task || task.completed) return false
      const dueDateStr = task.due?.date
      if (!dueDateStr) {
        return true
      }

      const rule = task.repeatRule as string | undefined
      if (!rule || rule === 'none') {
        return dueDateStr === todayStr
      }

      const target = new Date(`${todayStr}T00:00:00`)
      const due = new Date(`${dueDateStr}T00:00:00`)
      if (target < due) return false

      // Respect recurrence end date: if endDate is set and differs from
      // startDate, treat it as the last date the recurrence should appear
      const taskEndDate = task.endDate
      const taskStartDate = task.startDate ?? dueDateStr
      if (taskEndDate && taskEndDate !== taskStartDate && todayStr > taskEndDate) return false

      const day = target.getDay()
      const dueDay = due.getDay()
      const diffDays = Math.floor((target.getTime() - due.getTime()) / (24 * 60 * 60 * 1000))

      switch (rule) {
        case 'daily':
          return true
        case 'weekdays':
          return day >= 1 && day <= 5
        case 'weekly':
          return diffDays % 7 === 0 && day === dueDay
        case 'monthly': {
          const dueDateNum = due.getDate()
          const targetDateNum = target.getDate()
          const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
          if (dueDateNum > daysInTargetMonth) {
            return targetDateNum === daysInTargetMonth
          }
          return targetDateNum === dueDateNum
        }
        default:
          return false
      }
    }

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
