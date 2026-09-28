import { occursOnDate } from '../task-recurrence'
import type { Task } from '@/types/tasks'

// Run in a zone with daylight saving so the spring-forward day is 23 hours.
process.env.TZ = 'America/Chicago'

const task = (over: Partial<Task>): Task => ({ id: 't', content: 'x', completed: false, ...over }) as Task

describe('occursOnDate', () => {
  it('one-off tasks fall only on their date', () => {
    const t = task({ due: { date: '2026-10-02' } as Task['due'] })
    expect(occursOnDate(t, '2026-10-02')).toBe(true)
    expect(occursOnDate(t, '2026-10-03')).toBe(false)
  })

  it('weekly tasks keep occurring after the spring DST change', () => {
    // Sunday 2026-03-01; US clocks spring forward on 2026-03-08.
    const t = task({ due: { date: '2026-03-01' } as Task['due'], repeatRule: 'weekly' })
    expect(occursOnDate(t, '2026-03-08')).toBe(true)
    expect(occursOnDate(t, '2026-03-15')).toBe(true)
    expect(occursOnDate(t, '2026-03-16')).toBe(false)
  })

  it('weekdays skip weekends and nothing occurs before the start', () => {
    const t = task({ due: { date: '2026-09-28' } as Task['due'], repeatRule: 'weekdays' })
    expect(occursOnDate(t, '2026-09-27')).toBe(false)
    expect(occursOnDate(t, '2026-10-02')).toBe(true)
    expect(occursOnDate(t, '2026-10-03')).toBe(false)
  })

  it('monthly on the 31st lands on the last day of shorter months', () => {
    const t = task({ due: { date: '2026-01-31' } as Task['due'], repeatRule: 'monthly' })
    expect(occursOnDate(t, '2026-02-28')).toBe(true)
    expect(occursOnDate(t, '2026-03-31')).toBe(true)
  })
})
