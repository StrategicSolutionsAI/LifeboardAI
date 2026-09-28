'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, ListTodo, Loader2, RefreshCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBuckets } from '@/hooks/use-buckets'
import { invalidateTaskCaches } from '@/hooks/use-data-cache'
import { isoToHourSlot } from '@/lib/calendar-sync'
import { dateStr } from '@/lib/date-utils'
import { badge, button, text } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { TaskExtraction } from '@/lib/gmail/email-ai-utils'

// Items at or above this confidence start checked; the rest need an explicit opt-in.
const PRESELECT_CONFIDENCE = 0.7

type Phase = 'scanning' | 'error' | 'review' | 'saving' | 'saved'

function formatWhen(task: TaskExtraction): string | null {
  if (!task.dueDate) return null
  const [y, m, d] = task.dueDate.split('-').map(Number)
  const date = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  if (!task.dueTime) return date
  const [hh, mm] = task.dueTime.split(':').map(Number)
  const time = new Date(y, m - 1, d, hh, mm).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${date} · ${time}`
}

function confidenceBadge(confidence: number) {
  if (confidence >= 0.8) return { label: 'Likely', tone: badge.success }
  if (confidence >= 0.6) return { label: 'Possible', tone: badge.info }
  return { label: 'Unsure', tone: badge.neutral }
}

export function FindTasksModal({
  messageIds,
  account,
  onClose,
}: {
  messageIds: string[]
  account?: string
  onClose: () => void
}) {
  const { buckets } = useBuckets()
  const [phase, setPhase] = useState<Phase>('scanning')
  const [tasks, setTasks] = useState<TaskExtraction[]>([])
  const [scanned, setScanned] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [addedCount, setAddedCount] = useState(0)

  const scan = useCallback(async () => {
    setPhase('scanning')
    setError(null)
    try {
      const query = account ? `?account=${encodeURIComponent(account)}` : ''
      const res = await fetch(`/api/email/ai/extract-tasks${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds, buckets, today: dateStr(new Date()) }),
      })
      if (!res.ok) throw new Error(res.status === 503 ? 'The AI service is unavailable right now.' : `Request failed (${res.status})`)
      const data = (await res.json()) as { tasks: TaskExtraction[]; totalScanned?: number }
      setTasks(data.tasks)
      setScanned(data.totalScanned ?? messageIds.length)
      setSelected(new Set(data.tasks.flatMap((t, i) => (t.confidence >= PRESELECT_CONFIDENCE ? [i] : []))))
      setPhase('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not scan these emails.')
      setPhase('error')
    }
  // buckets are read once at scan time; re-scanning on every bucket refresh would re-bill the AI call
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageIds, account])

  useEffect(() => {
    scan()
  }, [scan])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'saving') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, phase])

  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const addSelected = async () => {
    setPhase('saving')
    setError(null)
    const indexes = Array.from(selected)
    const results = await Promise.allSettled(
      indexes.map(async (i) => {
        const task = tasks[i]
        const hourSlot = task.dueDate && task.dueTime ? isoToHourSlot(`${task.dueDate}T${task.dueTime}`) : null
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: task.title,
            due_date: task.dueDate,
            hour_slot: hourSlot,
            bucket: task.suggestedBucket && buckets.includes(task.suggestedBucket) ? task.suggestedBucket : null,
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return i
      })
    )

    const failed = new Set(indexes.filter((_, n) => results[n].status === 'rejected'))
    const added = indexes.length - failed.size
    if (added > 0) invalidateTaskCaches()

    if (failed.size === 0) {
      setAddedCount((n) => n + added)
      setPhase('saved')
      return
    }
    // Keep only the failures on screen so a retry cannot duplicate the ones that saved.
    const saved = new Set(indexes.filter((i) => !failed.has(i)))
    const remaining = tasks.filter((_, i) => !saved.has(i))
    setTasks(remaining)
    setSelected(new Set(remaining.map((_, i) => i)))
    setAddedCount((n) => n + added)
    setError(`${failed.size} task${failed.size === 1 ? '' : 's'} could not be added${added > 0 ? ` (${added} added)` : ''}. Try again.`)
    setPhase('review')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="find-tasks-title"
        className="bg-theme-surface-base w-full max-w-xl rounded-xl shadow-xl flex flex-col max-h-[85dvh] mx-4 outline-none"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-theme-neutral-300">
          <div className="flex items-center gap-2.5">
            <ListTodo className="h-5 w-5 text-theme-primary" />
            <h3 id="find-tasks-title" className={cn('text-base font-semibold', text.primary)}>Tasks found in your email</h3>
          </div>
          <button onClick={onClose} disabled={phase === 'saving'} aria-label="Close" className="p-2 rounded-lg hover:bg-theme-surface-raised min-w-[36px] min-h-[36px] flex items-center justify-center">
            <X className="h-4 w-4 text-theme-text-tertiary" />
          </button>
        </div>

        {phase === 'scanning' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-theme-primary" />
            <p className={cn('text-sm', text.secondary)}>Reading {messageIds.length} email{messageIds.length === 1 ? '' : 's'}…</p>
            <p className={cn('text-xs', text.tertiary)}>Nothing is added until you confirm</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className={cn('text-sm', text.secondary)}>Couldn&apos;t scan these emails</p>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button variant="outline" size="sm" onClick={scan} className="mt-2 gap-1.5">
              <RefreshCcw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </div>
        )}

        {phase === 'saved' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-theme-primary" />
            <p className={cn('text-sm font-medium', text.primary)}>
              Added {addedCount} task{addedCount === 1 ? '' : 's'}
            </p>
            <p className={cn('text-xs', text.tertiary)}>Tasks with a date also appear on your calendar.</p>
            <div className="mt-2 flex gap-2">
              <Link href="/tasks" className={cn(button.outline, 'h-9 px-3 rounded-lg text-sm inline-flex items-center', text.secondary)}>
                View tasks
              </Link>
              <button onClick={onClose} className={button.brand}>Done</button>
            </div>
          </div>
        )}

        {(phase === 'review' || phase === 'saving') && (
          <>
            <div className="px-5 py-3 border-b border-theme-neutral-300 bg-theme-surface-raised/50">
              <p className={cn('text-sm', text.secondary)}>
                {tasks.length === 0 ? (
                  <>No tasks found in {scanned} email{scanned === 1 ? '' : 's'}.</>
                ) : (
                  <>
                    <span className={cn('font-semibold', text.primary)}>{tasks.length}</span> possible task{tasks.length === 1 ? '' : 's'} in {scanned} email{scanned === 1 ? '' : 's'}. Pick the ones to add.
                  </>
                )}
              </p>
              {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
            </div>

            <ul className="flex-1 overflow-y-auto divide-y divide-theme-neutral-300/60">
              {tasks.map((task, i) => {
                const when = formatWhen(task)
                const conf = confidenceBadge(task.confidence)
                const bucket = task.suggestedBucket && buckets.includes(task.suggestedBucket) ? task.suggestedBucket : null
                return (
                  <li key={`${task.sourceEmailSubject}-${task.title}-${i}`}>
                    <label className="flex items-start gap-3 px-5 py-3 cursor-pointer hover:bg-theme-surface-raised">
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => toggle(i)}
                        disabled={phase === 'saving'}
                        className="mt-1 h-4 w-4 rounded border-theme-neutral-300 accent-theme-primary"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className={cn('text-sm font-medium truncate', text.primary)}>{task.title}</span>
                          <span className={cn(badge.base, conf.tone)} title={`${Math.round(task.confidence * 100)}% confidence`}>{conf.label}</span>
                        </span>
                        <span className={cn('mt-0.5 flex flex-wrap gap-x-2 text-xs', text.tertiary)}>
                          {when && <span>{when}</span>}
                          {bucket && <span>· {bucket}</span>}
                          {task.location && <span className="truncate max-w-[200px]">· {task.location}</span>}
                        </span>
                        <span className={cn('mt-0.5 block text-xs truncate', text.subtle)}>From “{task.sourceEmailSubject}”</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-theme-neutral-300">
              <Button variant="outline" size="sm" onClick={onClose} disabled={phase === 'saving'}>
                {tasks.length === 0 ? 'Close' : 'Cancel'}
              </Button>
              {tasks.length > 0 && (
                <button onClick={addSelected} disabled={selected.size === 0 || phase === 'saving'} className={cn(button.brandSm, 'inline-flex items-center gap-1.5')}>
                  {phase === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add {selected.size} task{selected.size === 1 ? '' : 's'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
