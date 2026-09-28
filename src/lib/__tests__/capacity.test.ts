import { capacitySummary, currentMood, cycleDay, lastNightSleep, scheduledHoursByDay } from '../capacity'

const TODAY = '2026-10-01' // a Thursday

describe('signals', () => {
  it('reads last night’s sleep from today or yesterday only', () => {
    const widgets = [{ sleepData: { entries: [
      { date: '2026-09-25', duration: 8, quality: 4 },
      { date: '2026-09-30', duration: 5.2, quality: 2 },
    ] } }]
    expect(lastNightSleep(widgets, TODAY)).toEqual({ hours: 5.2, quality: 2 })
    expect(lastNightSleep(widgets, '2026-10-05')).toBeNull()
  })

  it('reads today’s mood, falling back to yesterday', () => {
    expect(currentMood({ '2026-09-30': { mood: 'meh' } }, TODAY)).toBe('meh')
    expect(currentMood({}, TODAY)).toBeNull()
  })

  it('counts the cycle day from the latest logged period start and drops stale counts', () => {
    const widgets = [{ cycleData: { averageCycleLength: 28, entries: [
      { date: '2026-08-10', periodStart: true }, { date: '2026-09-06', periodStart: true },
    ] } }]
    expect(cycleDay(widgets, TODAY)).toEqual({ day: 26, averageLength: 28 })
    expect(cycleDay(widgets, '2026-12-30')).toBeNull()
  })
})

describe('scheduledHoursByDay', () => {
  const row = (over: Record<string, unknown>) => ({
    id: Math.random().toString(), user_id: 'me', content: 'x', completed: false, hour_slot: 'hour-9AM',
    due_date: TODAY, start_date: TODAY, end_date: TODAY, duration: 90, repeat_rule: null, assignee_id: null, ...over,
  })

  it('sums the user’s own timed tasks per day, including recurring ones', () => {
    const rows = [
      row({}),
      row({ duration: null }), // defaults to an hour
      row({ due_date: '2026-09-28', start_date: '2026-09-28', end_date: '2026-09-28', repeat_rule: 'daily', duration: 30 }),
      row({ user_id: 'partner' }), // someone else's
      row({ completed: true }),
    ]
    const load = scheduledHoursByDay(rows, { userId: 'me', today: TODAY, days: 3, accountByRosterId: new Map() })
    expect(load).toEqual([
      { date: '2026-10-01', hours: 3 },
      { date: '2026-10-02', hours: 0.5 },
      { date: '2026-10-03', hours: 0.5 },
    ])
  })

  it('counts a task assigned to me by my partner as mine', () => {
    const rows = [row({ user_id: 'partner', assignee_id: 'roster-me', duration: 120 })]
    const load = scheduledHoursByDay(rows, { userId: 'me', today: TODAY, days: 1, accountByRosterId: new Map([['roster-me', 'me']]) })
    expect(load[0].hours).toBe(2)
  })
})

describe('capacitySummary', () => {
  it('is null when there is nothing to say', () => {
    expect(capacitySummary({ sleep: null, mood: null, cycle: null, load: [{ date: TODAY, hours: 0 }] })).toBeNull()
  })

  it('lists the signals, flags heavy days, and tells the model how to use them', () => {
    const text = capacitySummary({
      sleep: { hours: 5.2, quality: 2 },
      mood: 'meh',
      cycle: { day: 2, averageLength: 28 },
      load: [{ date: TODAY, hours: 3 }, { date: '2026-10-02', hours: 11 }],
    })!
    expect(text).toContain("Last night's sleep: 5.2 h (quality 2/5)")
    expect(text).toContain('Mood today: meh')
    expect(text).toContain('Cycle: day 2 of about 28')
    expect(text).toContain('today 3 h, Fri 11 h (heavy)')
    expect(text).toMatch(/never diagnose/i)
  })
})
