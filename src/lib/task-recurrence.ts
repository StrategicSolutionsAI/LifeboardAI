import type { Task } from '@/types/tasks'

/**
 * Whether a task falls on a client-local YYYY-MM-DD date, honouring its repeat
 * rule and recurrence end. Shared by the schedule views and the reminder cron
 * so the two can never disagree about which day a task is on. A task with no
 * due date counts as every day.
 */
export function occursOnDate(task: Task, todayStr: string): boolean {
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
  // Round, not floor: a span containing the spring DST change is an hour short
  // of whole days, and flooring it dropped weekly tasks from March to November.
  const diffDays = Math.round((target.getTime() - due.getTime()) / (24 * 60 * 60 * 1000))

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
