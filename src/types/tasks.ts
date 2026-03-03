export type RepeatRule = 'daily' | 'weekly' | 'weekdays' | 'monthly'
export type RepeatOption = RepeatRule | 'none'
export type KanbanStatus = 'todo' | 'in_progress' | 'done'

export interface TaskDue {
  date?: string
  datetime?: string
  string?: string
  is_recurring?: boolean
}

export interface Task {
  id: string
  content: string
  completed: boolean
  due?: TaskDue | null
  startDate?: string | null
  endDate?: string | null
  duration?: number
  hourSlot?: string
  endHourSlot?: string | null
  bucket?: string
  position?: number
  created_at?: string
  updated_at?: string
  repeatRule?: RepeatRule
  allDay?: boolean
  source?: 'todoist' | 'supabase' | 'local'
  kanbanStatus?: KanbanStatus
}

export interface TaskOccurrenceException {
  id: string
  taskId: string
  occurrenceDate: string
  skip: boolean
  overrideHourSlot?: string | null
  overrideDuration?: number | null
  overrideBucket?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface TaskOccurrenceExceptionUpsertInput {
  taskId: string
  occurrenceDate: string
  skip?: boolean
  overrideHourSlot?: string | null
  overrideDuration?: number | null
  overrideBucket?: string | null
}
