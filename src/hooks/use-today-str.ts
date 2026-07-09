import { useEffect, useState } from 'react'
import { todayStrGlobal } from '@/lib/dashboard-utils'

/**
 * Local-timezone "today" (YYYY-MM-DD) as reactive state. Use this inside
 * useMemo/render paths instead of calling todayStrGlobal() directly — a bare
 * call inside a memo goes stale at midnight because nothing re-runs the memo
 * (the app, especially Electron, stays open across midnight). The minute
 * check is a no-op re-render-wise until the date actually changes.
 */
export function useTodayStr(): string {
  const [today, setToday] = useState(todayStrGlobal)

  useEffect(() => {
    const id = setInterval(() => {
      setToday((prev) => {
        const next = todayStrGlobal()
        return next === prev ? prev : next
      })
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  return today
}
