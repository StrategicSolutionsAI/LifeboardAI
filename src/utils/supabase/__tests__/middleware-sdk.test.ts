/** @jest-environment node */

import { NextRequest } from 'next/server'
import { updateSession } from '../middleware'

const host = 'middlewaretest.supabase.co'
const cookieName = 'sb-middlewaretest-auth-token'
const token = (salt: string, expiresAt: number) => `header.${Buffer.from(JSON.stringify({ exp: expiresAt, salt })).toString('base64url')}.signature`
const session = (salt: string, expired = false) => {
  const expiresAt = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600)
  return { access_token: token(salt, expiresAt), refresh_token: 'test-refresh-token',
    expires_at: expiresAt, expires_in: 3600, token_type: 'bearer', user: { id: 'test-user' } }
}
const request = (value: ReturnType<typeof session>, path = '/email') => new NextRequest(`https://lifeboard.test${path}`, {
  headers: { cookie: `${cookieName}=base64-${Buffer.from(JSON.stringify(value)).toString('base64url')}` },
})

describe('middleware with the installed Supabase SDK', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let fetchMock: jest.SpyInstance

  beforeEach(() => {
    jest.useFakeTimers()
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${host}`
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    fetchMock = jest.spyOn(global, 'fetch')
  })

  afterEach(async () => {
    // Let the SDK finish its retry loop; aborted retries must never reach fetch.
    await jest.advanceTimersByTimeAsync(35000)
    jest.useRealTimers()
    jest.restoreAllMocks()
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
  })

  it.each([429, 500, 503])('preserves browser credentials when expired-session refresh returns %s', async (status) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Temporarily unavailable' }), {
      status, headers: { 'Content-Type': 'application/json' },
    }))
    const complete = jest.fn()
    const pending = updateSession(request(session(`refresh-${status}`, true))).then(complete)
    await jest.advanceTimersByTimeAsync(5000)
    expect(complete).toHaveBeenCalledTimes(1)
    await pending
    const response = complete.mock.calls[0][0]
    expect(response.status).toBe(503)
    expect(response.cookies.getAll()).toEqual([])
    expect(response.headers.get('location')).toBeNull()
    const calls = fetchMock.mock.calls.length
    await jest.advanceTimersByTimeAsync(35000)
    expect(fetchMock).toHaveBeenCalledTimes(calls)
  })

  it('bounds a hung refresh, aborts the request, and prevents further network attempts', async () => {
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const pending = updateSession(request(session('hung-refresh', true)))
    await jest.advanceTimersByTimeAsync(5000)
    const response = await pending
    expect(response.status).toBe(503)
    expect(response.cookies.getAll()).toEqual([])
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    await jest.advanceTimersByTimeAsync(35000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retains a successful refresh when the subsequent user lookup times out', async () => {
    const rotated = session('rotated-before-timeout')
    fetchMock.mockImplementation((url, options) => {
      if (String(url).includes('/token?')) return Promise.resolve(new Response(JSON.stringify(rotated)))
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })
    const pending = updateSession(request(session('rotate-then-hang', true)))
    await jest.advanceTimersByTimeAsync(5000)
    const response = await pending
    expect(response.status).toBe(503)
    const value = response.cookies.get(cookieName)!.value
    expect(JSON.parse(Buffer.from(value.slice('base64-'.length), 'base64url').toString()).access_token).toBe(rotated.access_token)
    expect(response.headers.get('x-middleware-next')).toBeNull()
  })

  it('redirects a revoked refresh token and clears its invalid cookie', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Invalid refresh token', code: 'refresh_token_not_found' }), { status: 400 }))
    const response = await updateSession(request(session('revoked-refresh', true)))
    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login')
    expect(response.cookies.get(cookieName)?.maxAge).toBe(0)
  })

  it('allows a validated user and forwards a refreshed token to the rendered page', async () => {
    const rotated = session('rotated-success')
    fetchMock.mockImplementation(url => Promise.resolve(new Response(JSON.stringify(
      String(url).includes('/token?') ? rotated : { id: 'test-user' }
    ))))
    const response = await updateSession(request(session('valid-refresh', true)))
    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.cookies.get(cookieName)?.value).toBeTruthy()
    expect(response.headers.get('x-middleware-request-cookie')).toContain(response.cookies.get(cookieName)!.value)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
