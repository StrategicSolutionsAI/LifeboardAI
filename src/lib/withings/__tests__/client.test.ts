import { refreshWithingsToken } from '../client'

describe('refreshWithingsToken', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.WITHINGS_CLIENT_ID = 'test-client-id'
    process.env.WITHINGS_CLIENT_SECRET = 'test-client-secret'
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  function mockWithingsResponse(payload: unknown): jest.Mock {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    })
    global.fetch = fetchMock as unknown as typeof fetch
    return fetchMock
  }

  // Regression: refresh used action=refresh_token, which Withings rejects with
  // status 2554 ("wrong action") — every refresh failed and tokens got wiped,
  // forcing a reconnect each session. action must be requesttoken for all grants.
  it('sends action=requesttoken with grant_type=refresh_token', async () => {
    const fetchMock = mockWithingsResponse({
      status: 0,
      body: { access_token: 'at', refresh_token: 'rt' },
    })

    await refreshWithingsToken('old-refresh-token')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://wbsapi.withings.net/v2/oauth2')
    const params = new URLSearchParams(init.body)
    expect(params.get('action')).toBe('requesttoken')
    expect(params.get('grant_type')).toBe('refresh_token')
    expect(params.get('refresh_token')).toBe('old-refresh-token')
    expect(params.get('client_id')).toBe('test-client-id')
    expect(params.get('client_secret')).toBe('test-client-secret')
  })

  it('returns the token body on success', async () => {
    mockWithingsResponse({
      status: 0,
      body: { access_token: 'at2', refresh_token: 'rt2', expires_in: 10800 },
    })

    await expect(refreshWithingsToken('rt1')).resolves.toEqual({
      access_token: 'at2',
      refresh_token: 'rt2',
      expires_in: 10800,
    })
  })

  it('maps status 401 to INVALID_REFRESH_TOKEN', async () => {
    mockWithingsResponse({ status: 401, error: 'invalid_grant' })

    await expect(refreshWithingsToken('rt1')).rejects.toThrow('INVALID_REFRESH_TOKEN')
  })

  // Observed live: Withings rejects a dead refresh token with status 503
  // "Invalid Params: invalid refresh_token", not 401.
  it('maps status 503 with a refresh_token error to INVALID_REFRESH_TOKEN', async () => {
    mockWithingsResponse({ status: 503, error: 'Invalid Params: invalid refresh_token' })

    await expect(refreshWithingsToken('rt1')).rejects.toThrow('INVALID_REFRESH_TOKEN')
  })

  it('does not treat other 503 param errors as a dead refresh token', async () => {
    mockWithingsResponse({ status: 503, error: 'Invalid Params: missing client_id' })

    const err = await refreshWithingsToken('rt1').catch((e: Error) => e)
    expect((err as Error).message).not.toContain('INVALID_REFRESH_TOKEN')
    expect((err as Error).message).toContain('503')
  })

  // Status 2554 is a request bug (wrong action), not a dead token. It must not
  // surface as a permanent token error or callers wipe the stored tokens.
  it('does not report status 2554 as a permanent token failure', async () => {
    mockWithingsResponse({ status: 2554, error: 'Wrong action or wrong webservice' })

    const err = await refreshWithingsToken('rt1').catch((e: Error) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).not.toContain('REFRESH_TOKEN_EXPIRED')
    expect((err as Error).message).not.toContain('INVALID_REFRESH_TOKEN')
    expect((err as Error).message).toContain('2554')
  })
})
