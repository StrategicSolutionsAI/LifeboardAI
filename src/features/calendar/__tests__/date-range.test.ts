import {
  CALENDAR_DATE_STORAGE_KEY,
  CALENDAR_VIEW_STORAGE_KEY,
  calendarDateRange,
  googleEventsCacheKey,
  readStoredCalendarDate,
  readStoredCalendarView,
} from '../date-range'

describe('calendarDateRange', () => {
  const wed = new Date(2026, 6, 29) // Wednesday 2026-07-29

  it('spans the calendar month in month view', () => {
    const { start, end } = calendarDateRange('month', wed)
    expect(start.toDateString()).toBe(new Date(2026, 6, 1).toDateString())
    expect(end.getDate()).toBe(31)
  })

  it('spans Monday to Sunday in week view', () => {
    const { start, end } = calendarDateRange('week', wed)
    expect(start.getDay()).toBe(1)
    expect(end.getDay()).toBe(0)
  })

  it('spans a single day in day view', () => {
    const { start, end } = calendarDateRange('day', wed)
    expect(start.toDateString()).toBe(wed.toDateString())
    expect(end.toDateString()).toBe(wed.toDateString())
    expect(start.getHours()).toBe(0)
    expect(end.getHours()).toBe(23)
  })

  it('spans 14 days in agenda view', () => {
    const { start, end } = calendarDateRange('agenda', wed)
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000)
    expect(days).toBe(14) // 13 whole days + the tail of day 14
  })
})

describe('googleEventsCacheKey', () => {
  it('includes the view and both local day keys', () => {
    const wed = new Date(2026, 6, 29)
    expect(googleEventsCacheKey('day', calendarDateRange('day', wed))).toBe(
      'calendar-google-day-2026-07-29-2026-07-29',
    )
    expect(googleEventsCacheKey('month', calendarDateRange('month', wed))).toBe(
      'calendar-google-month-2026-07-01-2026-07-31',
    )
  })

  it('the key for the stored mount state is day-scoped by default, not month-scoped', () => {
    // The prefetch used to hardcode a month range while the calendar mounts in
    // day view, so it warmed a key the hook never read.
    const view = readStoredCalendarView()
    const key = googleEventsCacheKey(view, calendarDateRange(view, new Date(2026, 6, 29)))
    expect(key).toBe('calendar-google-day-2026-07-29-2026-07-29')
  })
})

describe('stored mount state', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to day view when nothing is stored', () => {
    expect(readStoredCalendarView()).toBe('day')
  })

  it('restores a stored view and ignores an unrecognised one', () => {
    localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, 'agenda')
    expect(readStoredCalendarView()).toBe('agenda')

    localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, 'fortnight')
    expect(readStoredCalendarView()).toBe('day')
  })

  it('restores a stored date', () => {
    localStorage.setItem(CALENDAR_DATE_STORAGE_KEY, '2026-03-04')
    const restored = readStoredCalendarDate()
    expect(restored.getFullYear()).toBe(2026)
    expect(restored.getMonth()).toBe(2)
    expect(restored.getDate()).toBe(4)
  })

  it('falls back to today when the stored date is unparseable', () => {
    // parseISO returns an Invalid Date instead of throwing, which would have
    // produced a NaN cache key.
    localStorage.setItem(CALENDAR_DATE_STORAGE_KEY, 'not-a-date')
    const restored = readStoredCalendarDate()
    expect(Number.isNaN(restored.getTime())).toBe(false)
    expect(restored.toDateString()).toBe(new Date().toDateString())
  })
})
