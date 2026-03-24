/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const supabaseMockInstance = {
  auth: {
    getUser: jest.fn(),
  },
}

const checkRateLimit = jest.fn()
const getRateLimitKey = jest.fn()

jest.mock('@/utils/supabase/server', () => ({
  supabaseServer: jest.fn(() => supabaseMockInstance),
}))

jest.mock('@/lib/rate-limit', () => ({
  realtimeLimiter: {
    check: (...args: unknown[]) => checkRateLimit(...args),
  },
  getRateLimitKey: (...args: unknown[]) => getRateLimitKey(...args),
}))

describe('/api/openai/realtime-session', () => {
  const originalEnv = process.env
  const fetchMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'test-openai-key',
      OPENAI_REALTIME_MODEL: 'gpt-4o-realtime-preview',
    }
    checkRateLimit.mockReturnValue(null)
    getRateLimitKey.mockReturnValue('user:test-user-id')
    global.fetch = fetchMock as typeof fetch
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('returns 401 when the caller is not authenticated', async () => {
    supabaseMockInstance.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const request = new NextRequest('http://localhost:3000/api/openai/realtime-session', {
      method: 'POST',
      body: JSON.stringify({ voice: 'alloy' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Not authenticated')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a realtime client secret for authenticated callers', async () => {
    supabaseMockInstance.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null,
    })
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        client_secret: { value: 'ephemeral-secret' },
      }),
    })

    const request = new NextRequest('http://localhost:3000/api/openai/realtime-session', {
      method: 'POST',
      body: JSON.stringify({ voice: 'alloy' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      client_secret: 'ephemeral-secret',
      model: 'gpt-4o-realtime-preview',
    })
    expect(getRateLimitKey).toHaveBeenCalledWith(request, 'test-user-id')
    expect(checkRateLimit).toHaveBeenCalledWith('user:test-user-id')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/realtime/sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-openai-key',
        }),
      })
    )
  })

  it('returns 429 when the caller exceeds the realtime session limit', async () => {
    supabaseMockInstance.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    })
    checkRateLimit.mockReturnValue(
      NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    )

    const request = new NextRequest('http://localhost:3000/api/openai/realtime-session', {
      method: 'POST',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toBe('Too many requests. Please try again later.')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
