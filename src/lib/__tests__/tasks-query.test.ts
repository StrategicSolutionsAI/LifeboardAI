import { allTasksUrl } from '../tasks-query'

process.env.TZ = 'America/Chicago'

describe('allTasksUrl', () => {
  it('asks for tasks finished since local midnight, not UTC midnight', () => {
    // 9:30 PM Sep 28 in Chicago is already Sep 29 in UTC.
    const url = allTasksUrl(new Date(2026, 8, 28, 21, 30))
    expect(url).toBe(`/api/tasks?all=true&completedSince=${encodeURIComponent('2026-09-28T05:00:00.000Z')}`)
  })
})
