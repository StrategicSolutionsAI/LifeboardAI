import { dateStr, getCurrentLocalDate, normalizeHourSlot } from '@/lib/date-utils'
import { todayStrGlobal, yesterdayStrGlobal } from '@/lib/dashboard-utils'

describe('dateStr', () => {
  it('formats local date components, zero-padded', () => {
    // Local-component constructor — independent of the machine timezone
    expect(dateStr(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(dateStr(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('uses the LOCAL date, not the UTC date, late in the evening', () => {
    // 23:30 local on Jul 9 — toISOString() would report Jul 10 anywhere
    // east of UTC and Jul 9/10 depending on offset; local must stay Jul 9.
    const lateEvening = new Date(2026, 6, 9, 23, 30)
    expect(dateStr(lateEvening)).toBe('2026-07-09')
  })
})

describe('today/yesterday helpers', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 9, 22, 15))
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('getCurrentLocalDate and todayStrGlobal agree (single implementation)', () => {
    expect(getCurrentLocalDate()).toBe('2026-07-09')
    expect(todayStrGlobal()).toBe('2026-07-09')
  })

  it('yesterdayStrGlobal crosses month boundaries correctly', () => {
    jest.setSystemTime(new Date(2026, 7, 1, 1, 0)) // Aug 1
    expect(yesterdayStrGlobal()).toBe('2026-07-31')
  })

  it('recomputes after midnight instead of serving a stale constant', () => {
    expect(todayStrGlobal()).toBe('2026-07-09')
    jest.setSystemTime(new Date(2026, 6, 10, 0, 5))
    expect(todayStrGlobal()).toBe('2026-07-10')
    expect(yesterdayStrGlobal()).toBe('2026-07-09')
  })
})

describe('normalizeHourSlot', () => {
  it('formats numeric hours into hour-<display>', () => {
    expect(normalizeHourSlot(0)).toBe('hour-12AM')
    expect(normalizeHourSlot(5)).toBe('hour-5AM')
    expect(normalizeHourSlot(12)).toBe('hour-12PM')
    expect(normalizeHourSlot(15)).toBe('hour-3PM')
    expect(normalizeHourSlot(23)).toBe('hour-11PM')
  })

  it('clamps out-of-range numbers', () => {
    expect(normalizeHourSlot(-1)).toBe('hour-12AM')
    expect(normalizeHourSlot(30)).toBe('hour-11PM')
  })

  it('prefixes bare display strings and preserves prefixed ones', () => {
    expect(normalizeHourSlot('3PM')).toBe('hour-3PM')
    expect(normalizeHourSlot('hour-3PM')).toBe('hour-3PM')
    expect(normalizeHourSlot('  3PM  ')).toBe('hour-3PM')
  })

  it('returns undefined for empty/missing input', () => {
    expect(normalizeHourSlot('')).toBeUndefined()
    expect(normalizeHourSlot('   ')).toBeUndefined()
    expect(normalizeHourSlot(null)).toBeUndefined()
    expect(normalizeHourSlot(undefined)).toBeUndefined()
    expect(normalizeHourSlot(NaN)).toBeUndefined()
  })
})
