'use client'

import { useEffect, useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import {
  disableReminders,
  enableReminders,
  getReminderStatus,
  sendTestReminder,
  type ReminderStatus,
} from '../push-client'

const STATUS_TEXT: Record<Exclude<ReminderStatus, 'on' | 'off'>, string> = {
  unsupported: 'This browser doesn’t support notifications.',
  'needs-install': 'On iPhone and iPad, add Lifeboard to your Home Screen (Share → Add to Home Screen), then turn reminders on from there.',
  blocked: 'Notifications are blocked for this site. Allow them in your browser settings to turn reminders on.',
}

export function ReminderSettings() {
  const [status, setStatus] = useState<ReminderStatus | null>(null)
  const [busy, setBusy] = useState<'toggle' | 'test' | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    getReminderStatus().then(setStatus).catch(() => setStatus('unsupported'))
  }, [])

  const run = async (kind: 'toggle' | 'test', action: () => Promise<void>, success: string) => {
    setBusy(kind)
    setMessage(null)
    try {
      await action()
      setMessage({ tone: 'ok', text: success })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Something went wrong' })
    } finally {
      setStatus(await getReminderStatus().catch(() => 'unsupported' as const))
      setBusy(null)
    }
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-warm-sm border border-theme-neutral-300">
      <div className="flex items-center gap-3 mb-5">
        <Bell className="w-5 h-5 text-theme-text-tertiary" />
        <div>
          <h2 className="text-xl font-semibold">Reminders</h2>
          <p className="text-sm text-theme-text-tertiary">Get a notification on this device before tasks that have a time</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-theme-surface-alt rounded-lg">
        <div>
          <h3 className="font-medium">Task reminders</h3>
          <p className="text-sm text-theme-text-tertiary">
            {status === null && 'Checking this device…'}
            {status === 'on' && 'On for this device. Tasks assigned to someone in your household remind them instead.'}
            {status === 'off' && 'Off for this device.'}
            {status && status !== 'on' && status !== 'off' && STATUS_TEXT[status]}
          </p>
        </div>
        {(status === 'on' || status === 'off') && (
          <div className="flex gap-2 shrink-0">
            {status === 'on' && (
              <button
                onClick={() => run('test', sendTestReminder, 'Test notification sent.')}
                disabled={busy !== null}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary border border-theme-neutral-300 bg-theme-surface-raised hover:bg-theme-surface-alt rounded-lg transition-colors disabled:opacity-50 w-full sm:w-auto"
              >
                {busy === 'test' && <Loader2 className="w-4 h-4 animate-spin" />}
                Send test
              </button>
            )}
            <button
              onClick={() =>
                status === 'on'
                  ? run('toggle', disableReminders, 'Reminders turned off for this device.')
                  : run('toggle', enableReminders, 'Reminders are on for this device.')
              }
              disabled={busy !== null}
              className={
                status === 'on'
                  ? 'flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary border border-theme-neutral-300 bg-theme-surface-raised hover:bg-theme-surface-alt rounded-lg transition-colors disabled:opacity-50 w-full sm:w-auto'
                  : 'flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-theme-primary hover:bg-theme-secondary rounded-lg transition-colors disabled:opacity-50 w-full sm:w-auto'
              }
            >
              {busy === 'toggle' && <Loader2 className="w-4 h-4 animate-spin" />}
              {status === 'on' ? 'Turn off' : 'Turn on'}
            </button>
          </div>
        )}
      </div>

      {message && (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={`mt-3 text-sm ${message.tone === 'error' ? 'text-red-600' : 'text-theme-text-secondary'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
