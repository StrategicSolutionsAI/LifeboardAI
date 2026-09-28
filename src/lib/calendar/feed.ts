import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

// Fetching a URL the user typed is a server-side request forgery risk: the
// host could be an internal address. Every hop (including redirects) must
// resolve only to public addresses.

const MAX_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 3

export class FeedError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
    this.name = 'FeedError'
  }
}

/** webcal:// is how calendars advertise subscribe links; it is plain https. */
export function normalizeFeedUrl(raw: string): string {
  const trimmed = raw.trim().replace(/^webcals?:\/\//i, 'https://')
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new FeedError('That doesn’t look like a calendar link')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new FeedError('Calendar links must start with https:// or webcal://')
  if (url.username || url.password) throw new FeedError('Calendar links with a username or password aren’t supported')
  if (url.port && url.port !== '80' && url.port !== '443') throw new FeedError('Calendar links on custom ports aren’t supported')
  return url.toString()
}

export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) ||           // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224                               // multicast and reserved
    )
  }
  const v6 = address.toLowerCase()
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7))
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address)
  if (addresses.length === 0) throw new FeedError('Couldn’t find that calendar’s server')
  if (addresses.some(isPrivateAddress)) throw new FeedError('That calendar link points to a private network address')
}

/** Fetch a feed's text, following at most 3 redirects, each re-validated. */
export async function fetchFeedText(feedUrl: string): Promise<string> {
  let current = normalizeFeedUrl(feedUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicHost(new URL(current).hostname)
      const res = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1', 'User-Agent': 'Lifeboard calendar sync' },
      })
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (!location) throw new FeedError('The calendar server sent a broken redirect', 502)
        current = normalizeFeedUrl(new URL(location, current).toString())
        continue
      }
      if (res.status === 401 || res.status === 403) throw new FeedError('That calendar is private. Use its secret or public iCal link.', 400)
      if (!res.ok) throw new FeedError(`The calendar server answered ${res.status}`, 502)

      const declared = Number(res.headers.get('content-length') ?? 0)
      if (declared > MAX_BYTES) throw new FeedError('That calendar is larger than 5 MB')
      const text = await readCapped(res)
      if (!text.includes('BEGIN:VCALENDAR')) throw new FeedError('That link isn’t an iCalendar feed')
      return text
    }
    throw new FeedError('The calendar link redirects too many times', 502)
  } catch (error) {
    if (error instanceof FeedError) throw error
    if ((error as Error).name === 'AbortError') throw new FeedError('The calendar server took too long to answer', 504)
    throw new FeedError('Couldn’t reach that calendar', 502)
  } finally {
    clearTimeout(timer)
  }
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return await res.text()
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) {
      await reader.cancel()
      throw new FeedError('That calendar is larger than 5 MB')
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}
