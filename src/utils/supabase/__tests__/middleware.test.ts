/** @jest-environment node */

import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getUserCached } from '@/lib/server-auth-cache'
import { updateSession } from '../middleware'

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }))
jest.mock('@/lib/server-auth-cache', () => ({ getUserCached: jest.fn() }))

const auth = jest.mocked(getUserCached)
const createClient = jest.mocked(createServerClient)
const request = (path = '/email?label=important') => new NextRequest(`https://lifeboard.test${path}`, {
  headers: { cookie: 'sb-test-auth-token=original; preference=keep' },
})

describe('middleware authentication availability', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    createClient.mockReturnValue({} as ReturnType<typeof createServerClient>)
    auth.mockResolvedValue({ data: { user: null }, error: null })
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it.each(['/', '/login', '/signup', '/auth/callback?code=example', '/privacy'])(
    'serves public %s without constructing an auth client', async (path) => {
      const response = await updateSession(request(path))
      expect(response.headers.get('x-middleware-next')).toBe('1')
      expect(createClient).not.toHaveBeenCalled()
      expect(response.headers.get('content-security-policy')).toContain("'nonce-")
    }
  )

  it('redirects missing credentials with the original destination', async () => {
    const response = await updateSession(request())
    const location = new URL(response.headers.get('location')!)
    expect(response.status).toBe(307)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('redirect')).toBe('/email?label=important')
  })

  it('does not treat a public-looking prefix as public', async () => {
    const response = await updateSession(request('/login-private'))
    expect(auth).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(307)
  })

  it('returns an uncached retry page within five seconds even if auth never settles', async () => {
    auth.mockReturnValue(new Promise(() => {}))
    const complete = jest.fn()
    const pending = updateSession(request()).then(complete)
    await jest.advanceTimersByTimeAsync(5000)
    expect(complete).toHaveBeenCalledTimes(1)
    await pending
    const response = complete.mock.calls[0][0]
    expect(response.status).toBe(503)
    expect(response.headers.get('x-middleware-next')).toBeNull()
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('retry-after')).toBe('5')
    expect(response.cookies.getAll()).toEqual([])
    expect(await response.text()).toContain('Try again')
  })

  it('does not forward an unverifiable session during a network failure', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: { name: 'AuthRetryableFetchError' } as any })
    const response = await updateSession(request())
    expect(response.status).toBe(503)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-next')).toBeNull()
  })

  it('handles an unexpected auth exception without exposing its contents', async () => {
    auth.mockRejectedValue(new Error('sensitive-token'))
    const response = await updateSession(request())
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('sensitive-token')
    expect(JSON.stringify(jest.mocked(console.warn).mock.calls)).not.toContain('sensitive-token')
  })

  it('passes refreshed cookies downstream and back to the browser after validation', async () => {
    auth.mockImplementation(async () => {
      const options = createClient.mock.calls[0][2] as any
      options.cookies.setAll([{ name: 'sb-test-auth-token', value: 'refreshed', options: { httpOnly: true } }])
      return { data: { user: { id: 'validated-user' } as any }, error: null }
    })
    const response = await updateSession(request())
    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('refreshed')
    expect(response.headers.get('x-middleware-request-cookie')).toContain('sb-test-auth-token=refreshed')
    expect(response.headers.get('x-middleware-request-cookie')).toContain('preference=keep')
    expect(response.headers.get('content-security-policy')).toContain(response.headers.get('x-nonce'))
    expect(jest.getTimerCount()).toBe(0)
  })

  it('aborts pending fetches and ignores late cookie changes after the deadline', async () => {
    let finish!: (result: any) => void
    auth.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((_input, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const complete = jest.fn()
    const pending = updateSession(request()).then(complete)
    const options = createClient.mock.calls[0][2] as any
    expect(options.global?.fetch).toBeDefined()
    const fetching = options.global.fetch('https://test.supabase.co/auth/v1/user').catch(() => {})
    await jest.advanceTimersByTimeAsync(5000)
    expect(complete).toHaveBeenCalledTimes(1)
    await pending
    await fetching
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true)
    const response = complete.mock.calls[0][0]
    options.cookies.setAll([{ name: 'sb-test-auth-token', value: 'late' }])
    finish({ data: { user: { id: 'late-user' } }, error: null })
    await jest.advanceTimersByTimeAsync(0)
    expect(response.cookies.getAll()).toEqual([])
    await expect(options.global.fetch('https://test.supabase.co/auth/v1/user')).rejects.toBeDefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
