import { lookup } from 'dns/promises'
import { isIP } from 'net'

const MAX_REDIRECTS = 3
const REQUEST_TIMEOUT_MS = 10_000

function isPrivateIpv4(value: string): boolean {
  const octets = value.split('.').map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return true
  }

  const [a, b] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function isPrivateIp(value: string): boolean {
  if (isIP(value) === 4) return isPrivateIpv4(value)

  const normalized = value.toLowerCase()
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('::ffff:')
  )
}

async function assertSafeUrl(value: string): Promise<URL> {
  if (value.length > 2048) throw new Error('Outbound URL is too long')

  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Outbound URL must use HTTP or HTTPS')
  }
  if (url.username || url.password) throw new Error('Outbound URL cannot contain credentials')
  if (url.port && !['80', '443'].includes(url.port)) {
    throw new Error('Outbound URL uses a blocked port')
  }

  const addresses = isIP(url.hostname)
    ? [url.hostname]
    : (await lookup(url.hostname, { all: true })).map(({ address }) => address)
  if (!addresses.length || addresses.some(isPrivateIp)) {
    throw new Error('Outbound URL resolves to a private or reserved address')
  }

  return url
}

/** Fetch an external URL while preventing private-network SSRF and unsafe redirects. */
export async function fetchSafeOutbound(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  let current = await assertSafeUrl(input)
  let requestInit: RequestInit = { ...init, redirect: 'manual' }

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(current, {
      ...requestInit,
      signal: requestInit.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (![301, 302, 303, 307, 308].includes(response.status)) return response
    const location = response.headers.get('location')
    if (!location || redirect === MAX_REDIRECTS) {
      throw new Error('Outbound redirect limit exceeded')
    }

    current = await assertSafeUrl(new URL(location, current).toString())
    if ([301, 302, 303].includes(response.status)) {
      requestInit = { ...requestInit, method: 'GET', body: undefined }
    }
  }

  throw new Error('Outbound redirect limit exceeded')
}
