import { parseQuickAdd } from '../quick-add-parser'

process.env.TZ = 'America/Chicago'

// Monday 2026-09-28, mid-morning local time.
const now = new Date(2026, 8, 28, 10, 0)
const buckets = ['Family', 'Home Projects', 'Work']

describe('parseQuickAdd', () => {
  it('leaves plain text alone', () => {
    expect(parseQuickAdd('Buy milk', now)).toMatchObject({
      title: 'Buy milk', dueDate: null, hourSlot: null, duration: null, repeat: null, bucket: null, matches: [],
    })
  })

  it('reads date, time, duration and bucket together', () => {
    const r = parseQuickAdd('Call mom tomorrow at 3:30pm for 45m #family', now, buckets)
    expect(r).toMatchObject({
      title: 'Call mom', dueDate: '2026-09-29', hourSlot: 'hour-3:30PM', duration: 45, bucket: 'Family',
    })
    expect(r.matches.map((m) => m.label)).toEqual(['Tomorrow', '3:30 PM', '45m', 'Family'])
  })

  it('matches multi-word buckets and keeps unknown hashtags in the title', () => {
    expect(parseQuickAdd('Paint fence #home-projects', now, buckets).bucket).toBe('Home Projects')
    expect(parseQuickAdd('Post #throwback photo', now, buckets)).toMatchObject({ title: 'Post #throwback photo', bucket: null })
  })

  it('reads weekday names as the next one after today', () => {
    expect(parseQuickAdd('Dentist friday', now).dueDate).toBe('2026-10-02')
    expect(parseQuickAdd('Standup monday', now).dueDate).toBe('2026-10-05')
    expect(parseQuickAdd('Pay rent on fri', now).dueDate).toBe('2026-10-02')
  })

  it('does not read ordinary words as abbreviated weekdays', () => {
    expect(parseQuickAdd('Buy sun cream', now)).toMatchObject({ title: 'Buy sun cream', dueDate: null })
  })

  it('reads relative and calendar dates', () => {
    expect(parseQuickAdd('Renew passport in 2 weeks', now).dueDate).toBe('2026-10-12')
    expect(parseQuickAdd('Plan trip next week', now).dueDate).toBe('2026-10-05')
    expect(parseQuickAdd('Clean garage this weekend', now).dueDate).toBe('2026-10-03')
    expect(parseQuickAdd('Party on oct 3rd', now)).toMatchObject({ title: 'Party', dueDate: '2026-10-03' })
    // A date already past this year rolls to next year.
    expect(parseQuickAdd('Taxes 4/15', now).dueDate).toBe('2027-04-15')
  })

  it('reads repeats and anchors them', () => {
    expect(parseQuickAdd('Vitamins every day at 8am', now)).toMatchObject({
      title: 'Vitamins', repeat: 'daily', dueDate: '2026-09-28', hourSlot: 'hour-8AM',
    })
    expect(parseQuickAdd('Trash every thursday', now)).toMatchObject({ repeat: 'weekly', dueDate: '2026-10-01' })
    // Today is Monday, so "every monday" starts today.
    expect(parseQuickAdd('Standup every monday', now).dueDate).toBe('2026-09-28')
  })

  it('strips prepositions left dangling by a removed phrase', () => {
    expect(parseQuickAdd('Pick up dinner for tonight', now)).toMatchObject({ title: 'Pick up dinner', dueDate: '2026-09-28' })
  })

  it('reads noon and 24-hour times, and rejects impossible ones', () => {
    expect(parseQuickAdd('Lunch at noon', now).hourSlot).toBe('hour-12PM')
    expect(parseQuickAdd('Gym 18:15', now).hourSlot).toBe('hour-6:15PM')
    expect(parseQuickAdd('Chapter 13pm', now).hourSlot).toBeNull()
  })

  it('keeps a schedule-only entry as its own title', () => {
    expect(parseQuickAdd('tomorrow', now)).toMatchObject({ title: 'tomorrow', dueDate: null, matches: [] })
  })
})
