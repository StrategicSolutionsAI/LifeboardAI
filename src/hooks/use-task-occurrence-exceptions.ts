import { useCallback, useMemo, useEffect, useState } from 'react'
import type { Task, TaskOccurrenceException, TaskOccurrenceExceptionUpsertInput } from '@/types/tasks'

// Module-level cache for occurrence exceptions to avoid re-fetching on every page mount
let _occurrenceExceptionsCache: { data: TaskOccurrenceException[]; ts: number } | null = null
const OCCURRENCE_CACHE_TTL = 60_000 // 60s

export function useTaskOccurrenceExceptions() {
  const [occurrenceExceptions, setOccurrenceExceptions] = useState<TaskOccurrenceException[]>([])

  const refreshOccurrenceExceptions = useCallback(async (force = false) => {
    if (typeof window === 'undefined') return
    // Return cached data if fresh (avoids re-fetching on every page navigation)
    if (!force && _occurrenceExceptionsCache && Date.now() - _occurrenceExceptionsCache.ts < OCCURRENCE_CACHE_TTL) {
      setOccurrenceExceptions(_occurrenceExceptionsCache.data)
      return
    }
    try {
      const res = await fetch('/api/task-occurrence-exceptions', {
        credentials: 'same-origin'
      })
      if (!res.ok) {
        console.warn('Failed to load task occurrence exceptions', res.status)
        return
      }
      const json = await res.json().catch(() => ({}))
      const list = Array.isArray(json?.exceptions) ? json.exceptions as TaskOccurrenceException[] : []
      _occurrenceExceptionsCache = { data: list, ts: Date.now() }
      setOccurrenceExceptions(list)
    } catch (error) {
      console.warn('Failed to refresh task occurrence exceptions', error)
    }
  }, [])

  useEffect(() => {
    refreshOccurrenceExceptions()
  }, [refreshOccurrenceExceptions])

  const upsertOccurrenceException = useCallback(async (input: TaskOccurrenceExceptionUpsertInput) => {
    const payload: Record<string, any> = {
      taskId: input.taskId,
      occurrenceDate: input.occurrenceDate,
      skip: input.skip ?? false,
    }

    if ('overrideHourSlot' in input) payload.overrideHourSlot = input.overrideHourSlot
    if ('overrideDuration' in input) payload.overrideDuration = input.overrideDuration
    if ('overrideBucket' in input) payload.overrideBucket = input.overrideBucket

    try {
      const res = await fetch('/api/task-occurrence-exceptions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText)
        throw new Error(errorText || `Failed to upsert occurrence exception (${res.status})`)
      }
      const json = await res.json().catch(() => ({}))
      const exception = json?.exception as TaskOccurrenceException | undefined
      if (exception) {
        setOccurrenceExceptions(prev => {
          const next = prev.filter(item => !(item.taskId === exception.taskId && item.occurrenceDate === exception.occurrenceDate))
          next.push(exception)
          return next
        })
      }
      return exception
    } catch (error) {
      console.warn('Failed to upsert occurrence exception', error)
      throw error
    }
  }, [])

  const occurrenceExceptionIndex = useMemo(() => {
    const map = new Map<string, Map<string, TaskOccurrenceException>>()
    occurrenceExceptions.forEach(exception => {
      if (!exception?.taskId || !exception.occurrenceDate) return
      if (!map.has(exception.taskId)) {
        map.set(exception.taskId, new Map())
      }
      map.get(exception.taskId)!.set(exception.occurrenceDate, exception)
    })
    return map
  }, [occurrenceExceptions])

  const applyOccurrenceAdjustments = useCallback((task: Task, occurrenceDate: string): Task | null => {
    const perTask = occurrenceExceptionIndex.get(task.id)
    if (!perTask) return task
    const exception = perTask.get(occurrenceDate)
    if (!exception) return task
    if (exception.skip) return null

    let next: Task = task
    let mutated = false

    if (exception.overrideHourSlot !== undefined) {
      if (!exception.overrideHourSlot) {
        return null
      }
      next = mutated ? next : { ...task }
      next.hourSlot = exception.overrideHourSlot ?? undefined
      mutated = true
    }

    if (exception.overrideDuration !== undefined) {
      next = mutated ? next : { ...task }
      next.duration = exception.overrideDuration ?? undefined
      mutated = true
    }

    if (exception.overrideBucket !== undefined) {
      next = mutated ? next : { ...task }
      next.bucket = exception.overrideBucket ?? undefined
      mutated = true
    }

    return next
  }, [occurrenceExceptionIndex])

  const getTaskForOccurrence = useCallback(
    (task: Task, occurrenceDate: string): Task | null =>
      applyOccurrenceAdjustments(task, occurrenceDate),
    [applyOccurrenceAdjustments]
  )

  return {
    occurrenceExceptions,
    occurrenceExceptionIndex,
    applyOccurrenceAdjustments,
    getTaskForOccurrence,
    upsertOccurrenceException,
  }
}
