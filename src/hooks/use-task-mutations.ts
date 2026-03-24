import { useCallback } from 'react'
import { OccurrenceDecision } from '@/contexts/tasks-occurrence-prompt-context'
import {
  inferSourceFromId,
  ensureTaskSource,
  ensureTasksSource,
} from './task-helpers'
import type { TaskSharedState } from './task-helpers'
import type { Task, RepeatRule, RepeatOption, KanbanStatus, TaskOccurrenceExceptionUpsertInput } from '@/types/tasks'

interface FetcherResult {
  dailyTasks: Task[] | null | undefined
  allTasks: Task[] | null | undefined
  updateDailyOptimistically: (updater: (current: Task[] | null) => Task[]) => void
  updateAllOptimistically: (updater: (current: Task[] | null) => Task[]) => void
  refetchDaily: () => void
  refetchAll: () => void
}

interface OccurrenceResult {
  upsertOccurrenceException: (input: TaskOccurrenceExceptionUpsertInput) => Promise<any>
}

export function useTaskMutations(
  dateStr: string,
  shared: TaskSharedState,
  fetcher: FetcherResult,
  occurrences: OccurrenceResult,
  promptOccurrenceDecision: (opts: { actionDescription: string; taskTitle: string }) => Promise<OccurrenceDecision>,
) {
  const {
    sharedFetchRef,
    sharedResultRef,
    todoistConnectedRef,
    setTodoistConnected,
    localUpdateTimestamps,
  } = shared

  const {
    dailyTasks,
    allTasks,
    updateDailyOptimistically,
    updateAllOptimistically,
    refetchDaily,
    refetchAll,
  } = fetcher

  const { upsertOccurrenceException } = occurrences

  // ── Create task ────────────────────────────────────────────────────

  const createTask = useCallback(async (
    content: string,
    dueDate: string | null,
    hourSlot?: number | string | null,
    bucket?: string,
    repeat: RepeatOption = 'none',
    options?: {
      endDate?: string | null
      endHourSlot?: number | string | null
      allDay?: boolean | null
      assigneeId?: string | null
      duration?: number | null
    }
  ) => {
    const trimmed = content.trim()
    if (!trimmed) {
      return;
    }
    const repeatRule = repeat !== 'none' ? repeat : undefined
    const { endDate: explicitEndDate, endHourSlot, allDay, duration: explicitDuration } = options ?? {}

    const normalizeHourSlot = (value?: number | string | null): string | undefined => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        const hh = Math.max(0, Math.min(23, value))
        if (hh === 0) return 'hour-12AM'
        if (hh < 12) return `hour-${hh}AM`
        if (hh === 12) return 'hour-12PM'
        return `hour-${hh - 12}PM`
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const trimmedValue = value.trim()
        return trimmedValue.startsWith('hour-') ? trimmedValue : `hour-${trimmedValue}`
      }
      return undefined
    }

    const normalizedHourSlot = normalizeHourSlot(hourSlot)
    const normalizedEndHourSlot = normalizeHourSlot(endHourSlot)
    const resolvedEndDate = explicitEndDate ?? dueDate
    const resolvedAllDay = typeof allDay === 'boolean'
      ? allDay
      : !normalizedHourSlot && !normalizedEndHourSlot

    // Helper: announce task update to other components
    const announceTaskUpdate = () => {
      if (typeof window !== 'undefined') {
        sharedFetchRef.current = null
        sharedResultRef.current = null
        const timestamp = Date.now()
        localUpdateTimestamps.current.add(timestamp)
        window.localStorage.setItem('lifeboard:last-tasks-update', timestamp.toString())
        window.dispatchEvent(new CustomEvent('lifeboard:tasks-updated', { detail: { timestamp } }))
      }
    }

    // Helper: add task to optimistic caches
    const addToOptimisticCaches = (task: Task) => {
      if (dueDate === dateStr) {
        updateDailyOptimistically(current => [...(current || []), task as any])
      }
      updateAllOptimistically(current => [...(current || []), task as any])
      announceTaskUpdate()
    }

    // Helper: create local task and persist to localStorage (last resort)
    const createLocalTask = (): any => {
      try {
        const generateUUID = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };
        const id = generateUUID()
        const task: Task = {
          id,
          content: trimmed,
          completed: false,
          due: dueDate ? { date: dueDate } : undefined,
          startDate: dueDate ?? undefined,
          endDate: resolvedEndDate ?? undefined,
          hourSlot: normalizedHourSlot,
          endHourSlot: normalizedEndHourSlot,
          duration: explicitDuration ?? undefined,
          assigneeId: options?.assigneeId ?? null,
          bucket: bucket || undefined,
          position: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          repeatRule: repeatRule,
          allDay: resolvedAllDay,
          source: 'local'
        }
        if (typeof window !== 'undefined') {
          const raw = window.localStorage.getItem('lifeboard_local_tasks')
          const list: Task[] = raw ? JSON.parse(raw) : []
          list.unshift(task)
          window.localStorage.setItem('lifeboard_local_tasks', JSON.stringify(list))
        }
        return task
      } catch (e) {
        console.warn('Failed to create local task', e)
        return null
      }
    }

    // Supabase request body — used for primary write
    const supabaseBody = {
      content: trimmed,
      start_date: dueDate,
      end_date: resolvedEndDate,
      hourSlot: normalizedHourSlot,
      endHourSlot: normalizedEndHourSlot,
      bucket,
      repeat_rule: repeatRule,
      allDay: resolvedAllDay,
      duration: explicitDuration ?? undefined,
      assignee_id: options?.assigneeId ?? null,
    }

    // ── Step 1: Always write to Supabase first ──
    try {
      const supaRes = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supabaseBody),
      })

      if (supaRes.ok) {
        const json = await supaRes.json()
        const task = ensureTaskSource(json.task as Task, 'supabase')
        addToOptimisticCaches(task)

        // ── Step 2: Also sync to Todoist if connected (best-effort, non-blocking) ──
        if (todoistConnectedRef.current !== false) {
          fetch('/api/integrations/todoist/tasks', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: trimmed,
              due_date: dueDate,
              start_date: dueDate,
              end_date: resolvedEndDate,
              hour_slot: normalizedHourSlot,
              end_hour_slot: normalizedEndHourSlot,
              bucket,
              repeat_rule: repeatRule,
              all_day: resolvedAllDay,
            }),
          }).then(res => {
            if (!res.ok) {
              if (res.status === 400 || res.status === 401) {
                setTodoistConnected(false)
              }
            } else {
              setTodoistConnected(true)
            }
          }).catch(() => {
            // Todoist sync failed silently — Supabase already has the task
          })
        }

        return task
      }

      // Supabase write failed — log and try Todoist as fallback
      const supaError = await supaRes.text().catch(() => '')
      console.warn('Supabase task creation failed:', supaRes.status, supaError)
    } catch (supaErr) {
      console.warn('Supabase task creation network error:', supaErr)
    }

    // ── Step 3: Supabase failed — try Todoist as fallback ──
    try {
      const res = await fetch('/api/integrations/todoist/tasks', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          due_date: dueDate,
          start_date: dueDate,
          end_date: resolvedEndDate,
          hour_slot: normalizedHourSlot,
          end_hour_slot: normalizedEndHourSlot,
          bucket,
          repeat_rule: repeatRule,
          all_day: resolvedAllDay,
        }),
      })

      if (res.ok) {
        setTodoistConnected(true)
        const responseData = await res.json()
        const { task } = responseData

        // Parse LIFEBOARD_META from Todoist description
        let metadata: {
          duration?: number; hourSlot?: string; bucket?: string; repeatRule?: RepeatRule
          startDate?: string | null; endDate?: string | null; endHourSlot?: string | null; allDay?: boolean
        } = {}
        let cleanContent: string = task.content
        try {
          if (task.description) {
            const metaMatch = task.description.match(/\[LIFEBOARD_META\](.*?)\[\/LIFEBOARD_META\]/)
            if (metaMatch) metadata = JSON.parse(metaMatch[1])
          }
          if (typeof task.content === 'string') {
            const contentMetaMatch = task.content.match(/^(.*?)\s*\[LIFEBOARD_META\].*?\[\/LIFEBOARD_META\]$/)
            if (contentMetaMatch) {
              cleanContent = contentMetaMatch[1].trim()
              if (Object.keys(metadata).length === 0) {
                const metaMatch2 = task.content.match(/\[LIFEBOARD_META\](.*?)\[\/LIFEBOARD_META\]/)
                if (metaMatch2) metadata = JSON.parse(metaMatch2[1])
              }
            }
          }
        } catch { /* ignore parse errors */ }

        const enhancedTask = {
          ...task, content: cleanContent,
          ...(metadata.duration !== undefined ? { duration: metadata.duration } : {}),
          ...(metadata.hourSlot !== undefined ? { hourSlot: metadata.hourSlot } : {}),
          ...(metadata.bucket !== undefined ? { bucket: metadata.bucket } : {}),
          ...(metadata.repeatRule !== undefined ? { repeatRule: metadata.repeatRule } : {}),
          ...(metadata.startDate !== undefined ? { startDate: metadata.startDate } : {}),
          ...(metadata.endDate !== undefined ? { endDate: metadata.endDate } : {}),
          ...(metadata.endHourSlot !== undefined ? { endHourSlot: metadata.endHourSlot } : {}),
          ...(metadata.allDay !== undefined ? { allDay: metadata.allDay } : {}),
        }
        const todoistTask = ensureTaskSource(enhancedTask as Task, 'todoist')
        addToOptimisticCaches(todoistTask)
        return todoistTask
      }

      if (res.status === 400 || res.status === 401) {
        setTodoistConnected(false)
      }
    } catch {
      // Todoist also failed
    }

    // ── Step 4: Both failed — local storage as last resort ──
    console.warn('Both Supabase and Todoist failed — creating local task')
    const local = createLocalTask()
    if (local) {
      addToOptimisticCaches(local)
      return local
    }
    throw new Error('Failed to create task: all persistence methods failed')
  }, [dateStr, updateDailyOptimistically, updateAllOptimistically, sharedFetchRef, sharedResultRef, todoistConnectedRef, setTodoistConnected, localUpdateTimestamps])

  // ── Toggle task completion ─────────────────────────────────────────

  const toggleTaskCompletion = useCallback(async (taskId: string) => {
    const task = allTasks?.find(t => t.id?.toString?.() === taskId?.toString?.()) ||
                 dailyTasks?.find(t => t.id?.toString?.() === taskId?.toString?.())

    if (!task) return

    const source = (task.source ?? inferSourceFromId(task.id)) as 'todoist' | 'supabase' | 'local'
    const newCompleted = !task.completed

    const newKanbanStatus: KanbanStatus = newCompleted ? 'done' : 'todo'
    const updater = (tasks: Task[] | null) =>
      tasks?.map(t => t.id === taskId ? { ...t, completed: newCompleted, kanbanStatus: newKanbanStatus } : t) || []

    const revertOptimistic = () => {
      const oldKanbanStatus: KanbanStatus = !newCompleted ? 'done' : 'todo'
      const revertUpdater = (tasks: Task[] | null) =>
        tasks?.map(t => t.id === taskId ? { ...t, completed: !newCompleted, kanbanStatus: oldKanbanStatus } : t) || []
      updateDailyOptimistically(revertUpdater)
      updateAllOptimistically(revertUpdater)
    }

    const persistLocalToggle = () => {
      if (typeof window === 'undefined') return
      try {
        const raw = window.localStorage.getItem('lifeboard_local_tasks')
        const list: Task[] = raw ? JSON.parse(raw) : []
        const normalized = ensureTasksSource(list, 'local')
        const updated = normalized.map(t =>
          t.id?.toString?.() === taskId?.toString?.()
            ? { ...t, completed: newCompleted, updated_at: new Date().toISOString(), source: 'local' as const }
            : t
        )
        window.localStorage.setItem('lifeboard_local_tasks', JSON.stringify(updated))
      } catch {}
    }

    const toggleViaSupabase = async () => {
      const endpoint = newCompleted ? '/api/tasks/complete' : '/api/tasks/reopen'
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })
      if (!res.ok) throw new Error('Failed to toggle task (supabase)')
      if (source === 'local') {
        persistLocalToggle()
      }
    }

    const toggleViaTodoist = async () => {
      const endpoint = newCompleted
        ? '/api/integrations/todoist/tasks/complete'
        : '/api/integrations/todoist/tasks/reopen'

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })

      if (res.ok) return

      if (res.status === 400 || res.status === 401) {
        setTodoistConnected(false)
        await toggleViaSupabase()
        return
      }

      throw new Error('Failed to toggle task')
    }

    updateDailyOptimistically(updater)
    updateAllOptimistically(updater)

    const shouldUseSupabaseFirst = todoistConnectedRef.current === false || source !== 'todoist'

    try {
      if (shouldUseSupabaseFirst) {
        await toggleViaSupabase()
        return
      }

      await toggleViaTodoist()
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error(String(caught))
      const isNetwork = error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('Network'))

      if (!shouldUseSupabaseFirst && (todoistConnectedRef.current === false || isNetwork)) {
        try {
          await toggleViaSupabase()
          return
        } catch (supabaseError) {
          if ((source as string) === 'local') {
            persistLocalToggle()
            return
          }
          revertOptimistic()
          throw supabaseError
        }
      }

      if (shouldUseSupabaseFirst && (source as string) === 'local') {
        persistLocalToggle()
        return
      }

      revertOptimistic()
      throw error
    }
  }, [allTasks, dailyTasks, updateDailyOptimistically, updateAllOptimistically, todoistConnectedRef, setTodoistConnected])

  // ── Batch update ───────────────────────────────────────────────────

  const batchUpdateTasks = useCallback(async (
    updates: { taskId: string; updates: Partial<Task>; occurrenceDate?: string }[],
    options?: { occurrenceDecision?: Exclude<OccurrenceDecision, 'cancel'> }
  ) => {
    if (!Array.isArray(updates) || updates.length === 0) return

    const taskCache = new Map<string, Task | undefined>()
    const resolveTask = (id: string): Task | undefined => {
      const lookup = id.toString()
      if (!lookup) return undefined
      if (!taskCache.has(lookup)) {
        const match = (dailyTasks || []).find(t => t.id?.toString?.() === lookup)
          || (allTasks || []).find(t => t.id?.toString?.() === lookup)
        taskCache.set(lookup, match)
      }
      return taskCache.get(lookup)
    }

    const hasOwn = (obj: Record<string, any>, key: string) => Object.prototype.hasOwnProperty.call(obj, key)
    const touchesScheduledFields = (patch: Partial<Task>) => {
      const raw = (patch ?? {}) as Record<string, any>
      return hasOwn(raw, 'hourSlot') ||
        hasOwn(raw, 'endHourSlot') ||
        hasOwn(raw, 'startDate') ||
        hasOwn(raw, 'endDate') ||
        hasOwn(raw, 'duration') ||
        hasOwn(raw, 'allDay')
    }

    const describeChange = (patch?: Record<string, any>) => {
      const raw = patch ?? {}
      const parts: string[] = []
      if (hasOwn(raw, 'startDate') || hasOwn(raw, 'endDate')) parts.push('dates')
      if (hasOwn(raw, 'hourSlot') || hasOwn(raw, 'endHourSlot')) parts.push('scheduled time')
      if (hasOwn(raw, 'allDay')) parts.push('all-day status')
      if (hasOwn(raw, 'duration')) parts.push('duration')
      if (parts.length === 0) return 'Update this repeating task'
      if (parts.length === 1) return `Update the ${parts[0]} for this repeating task`
      if (parts.length === 2) return `Update the ${parts[0]} and ${parts[1]} for this repeating task`
      const last = parts[parts.length - 1]
      const initial = parts.slice(0, -1).join(', ')
      return `Update the ${initial}, and ${last} for this repeating task`
    }

    const resolveOccurrenceDate = (update: { updates: Partial<Task>; occurrenceDate?: string }, fallbackTask?: Task): string => {
      const raw = (update.updates ?? {}) as Record<string, any>
      const explicit = typeof update.occurrenceDate === 'string' ? update.occurrenceDate : undefined
      const fromPatch = typeof raw.occurrenceDate === 'string' ? raw.occurrenceDate : undefined
      const fromDue = raw.due && typeof raw.due === 'object' && typeof (raw.due as any)?.date === 'string'
        ? (raw.due as any).date as string
        : undefined
      const fromStartDate = typeof raw.startDate === 'string' ? raw.startDate : undefined

      const candidate = explicit || fromPatch || fromDue || fromStartDate
      if (candidate) return candidate

      const fallbackRule = fallbackTask?.repeatRule as RepeatOption | undefined
      if (fallbackRule && fallbackRule !== 'none') {
        return dateStr
      }

      return fallbackTask?.startDate ?? fallbackTask?.due?.date ?? dateStr
    }

    const repeatingTimeUpdates = updates
      .map(update => {
        const task = resolveTask(update.taskId)
        const taskRule = task?.repeatRule as RepeatOption | undefined
        if (!task || !taskRule || taskRule === 'none') return null
        if (!touchesScheduledFields(update.updates)) return null
        return { task, original: update }
      })
      .filter(Boolean) as { task: Task; original: { taskId: string; updates: Partial<Task>; occurrenceDate?: string } }[]

    let decision: OccurrenceDecision = options?.occurrenceDecision ?? 'all'
    if (repeatingTimeUpdates.length > 0) {
      if (!options?.occurrenceDecision) {
        const firstPatch = repeatingTimeUpdates[0].original.updates as Record<string, any> | undefined
        decision = await promptOccurrenceDecision({
          actionDescription: describeChange(firstPatch),
          taskTitle: repeatingTimeUpdates[0].task.content
        })
      }
      if (decision === 'cancel') return
    }

    const updatesForAll: { taskId: string; updates: Partial<Task> }[] = []
    const singleOccurrenceUpdates: { task: Task; updates: Partial<Task>; occurrenceDate: string }[] = []

    updates.forEach(update => {
      const task = resolveTask(update.taskId)
      const taskRule = task?.repeatRule as RepeatOption | undefined
      if (!task || !taskRule || taskRule === 'none') {
        updatesForAll.push(update)
        return
      }
      if (decision === 'single' && touchesScheduledFields(update.updates)) {
        const occurrenceDate = resolveOccurrenceDate(update, task)
        singleOccurrenceUpdates.push({ task, updates: update.updates, occurrenceDate })
        return
      }
      updatesForAll.push(update)
    })

    if (decision === 'single' && singleOccurrenceUpdates.length > 0) {
      for (const entry of singleOccurrenceUpdates) {
        const raw = (entry.updates ?? {}) as Record<string, any>
        const payload: TaskOccurrenceExceptionUpsertInput = {
          taskId: entry.task.id,
          occurrenceDate: entry.occurrenceDate,
          skip: false
        }
        if (hasOwn(raw, 'hourSlot')) payload.overrideHourSlot = raw.hourSlot ?? null
        if (hasOwn(raw, 'duration')) payload.overrideDuration = raw.duration ?? null
        if (hasOwn(raw, 'bucket')) payload.overrideBucket = raw.bucket ?? null
        try {
          await upsertOccurrenceException(payload)
        } catch (error) {
          if (typeof window !== 'undefined') {
            window.alert('Failed to update just this occurrence. Please try again.')
          }
          return
        }
      }
    }

    if (updatesForAll.length === 0) {
      return
    }

    const mergeTasks = (current: Task[] | null, pending: { taskId: string; updates: Partial<Task> }[], { constrainToDate }: { constrainToDate?: boolean } = {}) => {
      const map = new Map<string, Task>()
      ;(current || []).forEach(task => {
        map.set(task.id?.toString?.() ?? '', task)
      })

      pending.forEach(({ taskId, updates: partial }) => {
        const key = taskId?.toString?.() ?? ''
        if (!key) return
        const original = map.get(key) ?? resolveTask(key)
        const merged: Task = {
          id: original?.id ?? key,
          content: partial.content ?? original?.content ?? '',
          completed: partial.completed ?? original?.completed ?? false,
          ...original,
          ...partial,
        }
        map.set(key, merged)
      })

      let next = Array.from(map.values())
      if (constrainToDate) {
        next = next.filter(task => task.due?.date === dateStr)
      }
      return next
    }

    updateDailyOptimistically(tasks => mergeTasks(tasks, updatesForAll, { constrainToDate: true }))
    updateAllOptimistically(tasks => mergeTasks(tasks, updatesForAll))

    // Separate updates by task source
    const supabaseUpdates = updatesForAll.filter(update => {
      const task = resolveTask(update.taskId);
      const source = task?.source || inferSourceFromId(update.taskId);
      return source === 'supabase' || source === 'local';
    });

    const todoistUpdates = updatesForAll.filter(update => {
      const task = resolveTask(update.taskId);
      const source = task?.source || inferSourceFromId(update.taskId);
      return source === 'todoist';
    });

    // Invalidate shared fetch cache
    sharedFetchRef.current = null
    sharedResultRef.current = null

    // Send batch update to server
    try {
      if (supabaseUpdates.length > 0) {
        const res = await fetch('/api/tasks/batch-update', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: supabaseUpdates })
        })
        if (!res.ok) console.warn('Supabase batch update failed')
      }

      if (todoistUpdates.length === 0) {
        return;
      }

      const res = await fetch('/api/integrations/todoist/tasks/batch-update', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: todoistUpdates })
      })
      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        console.warn('❌ Batch update non-OK:', res.status, errorText)
        refetchDaily()
        refetchAll()
        return
      }
      const result = await res.json().catch(() => null)
    } catch (error) {
      console.warn('💥 Batch update network error (continuing with optimistic state):', error)
      try {
        await fetch('/api/tasks/batch-update', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: updatesForAll })
        })
      } catch {}
      refetchDaily()
      refetchAll()
      return
    }
  }, [updateDailyOptimistically, updateAllOptimistically, refetchDaily, refetchAll, allTasks, dailyTasks, dateStr, promptOccurrenceDecision, upsertOccurrenceException, sharedFetchRef, sharedResultRef])

  // ── Delete task ────────────────────────────────────────────────────

  const findTaskById = useCallback((taskId: string): Task | undefined => {
    const lookup = taskId?.toString?.() ?? ''
    if (!lookup) return undefined
    return (dailyTasks || []).find(t => t.id?.toString?.() === lookup)
      || (allTasks || []).find(t => t.id?.toString?.() === lookup)
  }, [dailyTasks, allTasks])

  const resolveTaskSource = useCallback((taskId: string): Task['source'] => {
    const lookup = taskId?.toString?.() ?? ''
    if (!lookup) return 'supabase'
    const match = findTaskById(taskId)
    if (match) {
      return ensureTaskSource(match).source ?? inferSourceFromId(match.id)
    }
    return inferSourceFromId(lookup)
  }, [findTaskById])

  const deleteTask = useCallback(async (taskId: string, occurrenceDateInput?: string) => {
    const task = findTaskById(taskId)
    let decision: OccurrenceDecision = 'all'

    if (!task) {
      return
    }

    const taskRepeatRule = task?.repeatRule as RepeatOption | undefined
    if (taskRepeatRule && taskRepeatRule !== 'none') {
      decision = await promptOccurrenceDecision({
        actionDescription: 'Delete this repeating task',
        taskTitle: task.content
      })
      if (decision === 'cancel') {
        return
      }
      if (decision === 'single') {
        const occurrenceDate = occurrenceDateInput || task.due?.date || dateStr
        try {
          await upsertOccurrenceException({
            taskId,
            occurrenceDate,
            skip: true
          })
          // Force calendar recomputation: allTasks reference must change so
          // lifeboardEventMap recomputes and calls getTaskForOccurrence which
          // now returns null for the skipped occurrence.
          updateAllOptimistically(tasks => tasks ? [...tasks] : [])
        } catch (error) {
          if (typeof window !== 'undefined') {
            window.alert('Failed to skip this occurrence. Please try again.')
          }
        }
        return
      }
    }

    // Update optimistically by removing the task
    const updater = (tasks: Task[] | null) =>
      tasks?.filter(t => t.id.toString() !== taskId) || []

    updateDailyOptimistically(updater)
    updateAllOptimistically(updater)

    const source = resolveTaskSource(taskId)

    const deleteViaSupabase = async () => {
      const res = await fetch('/api/tasks/delete', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })
      if (!res.ok) throw new Error('Failed to delete task (supabase)')
    }

    const preferSupabase = todoistConnectedRef.current === false || source !== 'todoist'

    try {
      if (preferSupabase) {
        await deleteViaSupabase()
        return
      }

      const res = await fetch('/api/integrations/todoist/tasks/delete', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })

      if (!res.ok) {
        if (res.status === 400 || res.status === 401) {
          setTodoistConnected(false)
          await deleteViaSupabase()
          return
        }

        if (res.status === 404) {
          await Promise.all([refetchDaily(), refetchAll()])
          return
        }

        throw new Error('Failed to delete task')
      }
    } catch (error) {
      const isNetwork = error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('Network'))
      if (preferSupabase || todoistConnectedRef.current === false || isNetwork) {
        try {
          await deleteViaSupabase()
          return
        } catch {}
        return
      }
      refetchDaily()
      refetchAll()
      throw error
    }
  }, [findTaskById, promptOccurrenceDecision, upsertOccurrenceException, dateStr, updateDailyOptimistically, updateAllOptimistically, refetchDaily, refetchAll, resolveTaskSource, todoistConnectedRef, setTodoistConnected])

  return {
    createTask,
    toggleTaskCompletion,
    batchUpdateTasks,
    deleteTask,
  }
}
