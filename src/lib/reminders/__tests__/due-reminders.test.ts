import { dueReminders, hourSlotMinutes, localNow } from '../due-reminders'

const row = (over: Record<string, unknown>) => ({
  id: 't1', user_id: 'me', content: 'Dentist', completed: false, due_date: '2026-09-28',
  start_date: '2026-09-28', end_date: '2026-09-28', hour_slot: 'hour-9:30AM', repeat_rule: null,
  assignee_id: null, ...over,
})

const base = {
  recipientId: 'me',
  today: '2026-09-28',
  overrides: new Map(),
  accountByRosterId: new Map<string, string>(),
}

describe('hourSlotMinutes', () => {
  it.each([
    ['hour-9AM', 540], ['hour-9:30AM', 570], ['hour-12AM', 0], ['hour-12PM', 720], ['hour-11:45PM', 1425],
  ])('%s → %i', (slot, minutes) => expect(hourSlotMinutes(slot)).toBe(minutes))
  it('rejects junk', () => expect(hourSlotMinutes('soon')).toBeNull())
})

describe('localNow', () => {
  it('uses the user zone, not the server clock', () => {
    // 02:15 UTC on the 29th is still 21:15 on the 28th in Chicago.
    expect(localNow(new Date('2026-09-29T02:15:00Z'), 'America/Chicago')).toEqual({ date: '2026-09-28', minutes: 21 * 60 + 15 })
  })
  it('falls back to UTC for an unknown zone', () => {
    expect(localNow(new Date('2026-09-29T02:15:00Z'), 'Not/AZone').date).toBe('2026-09-29')
  })
})

describe('dueReminders', () => {
  it('reminds within 20 minutes before start and up to 10 after', () => {
    expect(dueReminders([row({})], { ...base, nowMinutes: 570 - 21 })).toEqual([])
    expect(dueReminders([row({})], { ...base, nowMinutes: 570 - 15 })).toEqual([{ taskId: 't1', title: 'Dentist', body: 'Starts at 9:30 AM' }])
    expect(dueReminders([row({})], { ...base, nowMinutes: 570 + 5 })[0].body).toBe('Started at 9:30 AM')
    expect(dueReminders([row({})], { ...base, nowMinutes: 570 + 11 })).toEqual([])
  })

  it('skips other days, skipped occurrences, and honours a moved occurrence', () => {
    expect(dueReminders([row({ due_date: '2026-09-29', start_date: '2026-09-29', end_date: '2026-09-29' })], { ...base, nowMinutes: 560 })).toEqual([])
    const skip = new Map([['t1', { skip: true, overrideHourSlot: null }]])
    expect(dueReminders([row({})], { ...base, nowMinutes: 560, overrides: skip })).toEqual([])
    const moved = new Map([['t1', { skip: false, overrideHourSlot: 'hour-2PM' }]])
    expect(dueReminders([row({})], { ...base, nowMinutes: 830, overrides: moved })[0].body).toBe('Starts at 2:00 PM')
  })

  it('includes recurring tasks on their occurrence days', () => {
    const daily = row({ due_date: '2026-09-01', start_date: '2026-09-01', end_date: '2026-09-01', repeat_rule: 'daily' })
    expect(dueReminders([daily], { ...base, nowMinutes: 560 })).toHaveLength(1)
  })

  it('sends a task assigned to a linked household account to that account, not its author', () => {
    const assigned = row({ assignee_id: 'roster-partner' })
    const accounts = new Map([['roster-partner', 'partner']])
    expect(dueReminders([assigned], { ...base, nowMinutes: 560, accountByRosterId: accounts })).toEqual([])
    expect(dueReminders([assigned], { ...base, recipientId: 'partner', nowMinutes: 560, accountByRosterId: accounts })).toHaveLength(1)
    // A roster member without an account (a child) leaves the reminder with the author.
    expect(dueReminders([row({ assignee_id: 'roster-kid' })], { ...base, nowMinutes: 560, accountByRosterId: accounts })).toHaveLength(1)
  })
})
