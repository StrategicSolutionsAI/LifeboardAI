import { fetchSafeOutbound } from '@/lib/safe-outbound-fetch'

jest.mock('dns/promises', () => ({
  lookup: jest.fn().mockResolvedValue([{ address: '93.184.216.34' }]),
}))

describe('fetchSafeOutbound', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('rejects private IP literals before making a request', async () => {
    const fetchMock = jest.fn()
    globalThis.fetch = fetchMock as typeof fetch

    await expect(fetchSafeOutbound('http://127.0.0.1/internal')).rejects.toThrow(
      'private or reserved',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('revalidates redirect destinations', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      {
        status: 302,
        headers: { get: () => 'http://169.254.169.254/latest/meta-data' },
      } as unknown as Response,
    ) as typeof fetch

    await expect(fetchSafeOutbound('https://example.com/unsubscribe')).rejects.toThrow(
      'private or reserved',
    )
  })
})
