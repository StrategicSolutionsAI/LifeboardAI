/**
 * Local-timezone date key (YYYY-MM-DD). The single implementation — never
 * use toISOString() for date keys, it is UTC and rolls to tomorrow's date
 * during evening hours west of Greenwich. dashboard-utils re-exports this.
 */
export function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Get the current date in YYYY-MM-DD format using local timezone
 * This ensures consistent date handling across the application
 */
export function getCurrentLocalDate(): string {
  return dateStr(new Date())
}

/**
 * Format a date string for display
 */
export function formatDateForDisplay(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

/**
 * Normalize an hour-slot value to the canonical `hour-<display>` format
 * (e.g. 15 → "hour-3PM", "3PM" → "hour-3PM"). This string format is the
 * scheduling primitive shared by the tasks API and the client mutation
 * layer — both must import this single implementation.
 */
export function normalizeHourSlot(value?: number | string | null): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const h = Math.max(0, Math.min(23, value))
    const display =
      h === 0 ? '12AM' : h < 12 ? `${h}AM` : h === 12 ? '12PM' : `${h - 12}PM`
    return `hour-${display}`
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const trimmed = value.trim()
    return trimmed.startsWith('hour-') ? trimmed : `hour-${trimmed}`
  }
  return undefined
}
