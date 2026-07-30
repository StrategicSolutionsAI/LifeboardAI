import fs from 'fs'
import path from 'path'
import { dateStr } from '@/lib/date-utils'
import { getDateKey } from '@/lib/habit-utils'
import { todayStrGlobal } from '@/lib/dashboard-utils'

/**
 * Regression guard for the UTC/local date-key split.
 *
 * Nine widget files each defined a private `getDateKey` built on
 * `toISOString()`. That is a UTC key, so west of Greenwich every entry logged
 * after ~16:00 local was persisted under *tomorrow's* date — while the
 * dashboard cards that read those entries used the local key from
 * `todayStrGlobal()`. The cycle tracker's "today" lookup therefore returned
 * undefined all evening, and habit streaks reset a day early.
 *
 * The fix routes every client date key through the one implementation in
 * date-utils. These tests keep it that way.
 */

describe('one local date-key implementation', () => {
  it('habit-utils.getDateKey is dateStr itself, not a copy', () => {
    expect(getDateKey).toBe(dateStr)
  })

  it('widget writes and dashboard-card reads agree on the same key', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 9, 22, 15))
    try {
      // The widget persists with getDateKey(new Date()); the card looks the
      // entry up with todayStrGlobal(). These must never diverge.
      expect(getDateKey(new Date())).toBe(todayStrGlobal())
    } finally {
      jest.useRealTimers()
    }
  })

  it('keeps the calendar day stable across every hour', () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(dateStr(new Date(2026, 6, 9, hour, 30))).toBe('2026-07-09')
    }
  })
})

describe('no client module builds a date key from toISOString', () => {
  // Server code legitimately works in UTC (provider APIs, stored timestamps).
  // This rule is about keys the *browser* writes and reads.
  const CLIENT_DIRS = ['src/features', 'src/hooks', 'src/contexts', 'src/app/(app)']
  const UTC_KEY = /toISOString\(\)\s*\.\s*(split\(['"]T['"]\)\[0\]|slice\(0,\s*10\))/

  function walk(dir: string): string[] {
    const root = path.join(process.cwd(), dir)
    if (!fs.existsSync(root)) return []
    const out: string[] = []
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const rel = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue
        out.push(...walk(rel))
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(rel)
      }
    }
    return out
  }

  it('finds no toISOString-derived date keys', () => {
    const offenders = CLIENT_DIRS.flatMap(walk).filter((file) =>
      UTC_KEY.test(fs.readFileSync(path.join(process.cwd(), file), 'utf8'))
    )
    expect(offenders).toEqual([])
  })
})
