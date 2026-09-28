/**
 * @jest-environment node
 */
const lookup = jest.fn()
jest.mock('node:dns/promises', () => ({ lookup: (...a: unknown[]) => lookup(...a) }))

import { FeedError, fetchFeedText, isPrivateAddress, normalizeFeedUrl } from '../feed'

const ical = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR'
const response = (status: number, body = '', headers: Record<string, string> = {}) => new Response(body, { status, headers })

describe('normalizeFeedUrl', () => {
  it('turns webcal into https', () => {
    expect(normalizeFeedUrl('  webcal://calendar.school.org/feed.ics ')).toBe('https://calendar.school.org/feed.ics')
  })
  it.each([
    ['ftp://x.org/a.ics'], ['https://user:pw@x.org/a.ics'], ['https://x.org:8443/a.ics'], ['not a url'],
  ])('rejects %s', (raw) => expect(() => normalizeFeedUrl(raw)).toThrow(FeedError))
})

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])(
    '%s is private', (ip) => expect(isPrivateAddress(ip)).toBe(true))
  it.each(['8.8.8.8', '172.32.0.1', '2606:4700::1111'])('%s is public', (ip) => expect(isPrivateAddress(ip)).toBe(false))
})

describe('fetchFeedText', () => {
  const realFetch = global.fetch
  afterEach(() => { global.fetch = realFetch; jest.clearAllMocks() })

  it('refuses hosts that resolve to a private address', async () => {
    lookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }])
    global.fetch = jest.fn()
    await expect(fetchFeedText('https://intranet.example/feed.ics')).rejects.toThrow('private network')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('re-checks every redirect hop', async () => {
    lookup.mockImplementation(async (host: string) => [{ address: host === 'evil.example' ? '169.254.169.254' : '93.184.216.34', family: 4 }])
    global.fetch = jest.fn().mockResolvedValueOnce(response(302, '', { location: 'https://evil.example/meta' }))
    await expect(fetchFeedText('https://calendar.example/feed.ics')).rejects.toThrow('private network')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('returns the feed and rejects non-calendar content', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    global.fetch = jest.fn().mockResolvedValueOnce(response(200, ical))
    await expect(fetchFeedText('webcal://calendar.example/feed.ics')).resolves.toBe(ical)
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://calendar.example/feed.ics')

    global.fetch = jest.fn().mockResolvedValueOnce(response(200, '<html>login</html>'))
    await expect(fetchFeedText('https://calendar.example/feed.ics')).rejects.toThrow('isn’t an iCalendar feed')
  })

  it('explains a private calendar', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    global.fetch = jest.fn().mockResolvedValueOnce(response(403))
    await expect(fetchFeedText('https://calendar.example/feed.ics')).rejects.toThrow('private')
  })
})
