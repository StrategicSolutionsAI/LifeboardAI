/**
 * @jest-environment node
 *
 * Node env on purpose: jsdom's window.location is non-configurable, so the
 * redirect can't be observed there. fetchWithTimeout only needs
 * `typeof window !== 'undefined'` and `window.location.assign` — a minimal
 * stub gives full control.
 */
import { SESSION_EXPIRED_HEADER } from '@/lib/session-expired'

// Minimal stand-in — fetchWithTimeout only reads status and headers.get()
const makeRes = (status: number, headers: Record<string, string> = {}) =>
  ({
    status,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
  }) as unknown as Response

describe('fetchWithTimeout session-expiry redirect', () => {
  let assignMock: jest.Mock

  beforeEach(() => {
    // Fresh module per test — the redirect latch is module-level state
    jest.resetModules()
    assignMock = jest.fn()
    ;(globalThis as { window?: unknown }).window = {
      location: { assign: assignMock },
    }
  })

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('redirects to /login on a 401 marked session-expired', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(makeRes(401, { [SESSION_EXPIRED_HEADER]: '1' })) as unknown as typeof fetch
    const { fetchWithTimeout } = await import('../fetch-with-timeout')

    const res = await fetchWithTimeout('/api/tasks')

    expect(res.status).toBe(401)
    expect(assignMock).toHaveBeenCalledWith('/login')
  })

  it('does not redirect on provider-auth 401s without the marker', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeRes(401)) as unknown as typeof fetch
    const { fetchWithTimeout } = await import('../fetch-with-timeout')

    await fetchWithTimeout('/api/integrations/todoist/tasks')

    expect(assignMock).not.toHaveBeenCalled()
  })

  it('does not redirect on non-401 responses', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(makeRes(200, { [SESSION_EXPIRED_HEADER]: '1' })) as unknown as typeof fetch
    const { fetchWithTimeout } = await import('../fetch-with-timeout')

    await fetchWithTimeout('/api/tasks')

    expect(assignMock).not.toHaveBeenCalled()
  })

  it('redirects at most once per page lifetime', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(makeRes(401, { [SESSION_EXPIRED_HEADER]: '1' })) as unknown as typeof fetch
    const { fetchWithTimeout } = await import('../fetch-with-timeout')

    await fetchWithTimeout('/api/tasks')
    await fetchWithTimeout('/api/tasks')

    expect(assignMock).toHaveBeenCalledTimes(1)
  })
})
