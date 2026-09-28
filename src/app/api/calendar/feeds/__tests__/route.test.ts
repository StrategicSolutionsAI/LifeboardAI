/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const fetchFeedText = jest.fn()
const syncCalendarFeed = jest.fn()
jest.mock('@/lib/calendar/feed', () => {
  const actual = jest.requireActual('@/lib/calendar/feed')
  return { ...actual, fetchFeedText: (...a: unknown[]) => fetchFeedText(...a) }
})
jest.mock('@/lib/calendar/feed-sync', () => ({ syncCalendarFeed: (...a: unknown[]) => syncCalendarFeed(...a) }))

type Result = { data: unknown; error: unknown }
const queued: Result[] = []
const inserts: unknown[] = []
const rpc = jest.fn(async (..._args: unknown[]) => ({ error: null }))
const b: any = {}
for (const m of ['select', 'eq', 'order']) b[m] = () => b
b.insert = (payload: unknown) => { inserts.push(payload); return b }
b.single = b.maybeSingle = () => Promise.resolve(queued.shift() ?? { data: null, error: null })
const supabaseMock = {
  auth: { getUser: jest.fn(), getSession: jest.fn(async () => ({ data: { session: null } })) },
  from: () => b,
  rpc: (...a: unknown[]) => rpc(...a),
}
jest.mock('@/utils/supabase/server', () => ({ supabaseServer: jest.fn(() => supabaseMock) }))

import { POST } from '../route'
import { FeedError } from '@/lib/calendar/feed'

const post = (body: unknown) => POST(new NextRequest('http://localhost:3000/api/calendar/feeds', { method: 'POST', body: JSON.stringify(body) }))
const signedIn = () => supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

beforeEach(() => { jest.clearAllMocks(); queued.length = 0; inserts.length = 0 })

describe('POST /api/calendar/feeds', () => {
  it('401 when signed out', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await post({ url: 'https://x.org/a.ics' })).status).toBe(401)
  })

  it('400 without a url, and for a link that is not a calendar', async () => {
    signedIn()
    expect((await post({})).status).toBe(400)
    fetchFeedText.mockRejectedValue(new FeedError('That link isn’t an iCalendar feed'))
    const res = await post({ url: 'https://x.org/page' })
    expect(res.status).toBe(400)
    expect(inserts).toHaveLength(0)
  })

  it('subscribes, naming the calendar from the feed', async () => {
    signedIn()
    fetchFeedText.mockResolvedValue('BEGIN:VCALENDAR\r\nX-WR-CALNAME:Tigers U10\r\nEND:VCALENDAR')
    queued.push({ data: null, error: null }, { data: { id: 'imp1', feed_url: 'https://x.org/a.ics', default_bucket: 'Sports' }, error: null })
    syncCalendarFeed.mockResolvedValue({ totalEvents: 12, insertedCount: 12, tasksCreated: 12, tasksUpdated: 0, tasksErrored: 0, removedEvents: 0 })

    const res = await post({ url: 'webcal://x.org/a.ics', bucket: 'Sports' })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toMatchObject({ success: true, calendarName: 'Tigers U10', importedEvents: 12, importId: 'imp1' })
    expect(inserts[0]).toMatchObject({ user_id: 'u1', name: 'Tigers U10', feed_url: 'https://x.org/a.ics', default_bucket: 'Sports' })
  })

  it('409 for a calendar already subscribed', async () => {
    signedIn()
    fetchFeedText.mockResolvedValue('BEGIN:VCALENDAR\r\nEND:VCALENDAR')
    queued.push({ data: { id: 'imp1' }, error: null })
    expect((await post({ url: 'https://x.org/a.ics' })).status).toBe(409)
  })
})
