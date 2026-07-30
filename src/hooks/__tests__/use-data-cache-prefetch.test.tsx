import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query-client'
import { prefetchToGlobalCache, useDataCache } from '../use-data-cache'

/**
 * prefetchToGlobalCache seeds the same key a useDataCache hook later reads, so a
 * prefetch fetcher that swallows a failed request into `[]` stores that as a
 * SUCCESSFUL result for the whole staleTime — the hook then renders empty and
 * never retries. These tests pin the contract the calendar prefetches rely on:
 * a rejecting prefetch must leave no data behind, so the hook's own fetcher runs.
 */

let n = 0
const nextKey = () => `prefetch-contract-${(n += 1)}`

function Probe({ cacheKey, fetcher }: { cacheKey: string; fetcher: () => Promise<string[]> }) {
  const { data } = useDataCache<string[]>(cacheKey, fetcher, { ttl: 300_000 })
  return <span data-testid="out">{data === null ? 'null' : JSON.stringify(data)}</span>
}

function renderProbe(cacheKey: string, fetcher: () => Promise<string[]>) {
  return render(
    <QueryClientProvider client={getQueryClient()}>
      <Probe cacheKey={cacheKey} fetcher={fetcher} />
    </QueryClientProvider>,
  )
}

describe('prefetchToGlobalCache / useDataCache handoff', () => {
  beforeEach(() => {
    getQueryClient().clear()
  })

  it('a rejecting prefetch leaves no data, so the hook fetches for itself', async () => {
    const cacheKey = nextKey()
    const failing = jest.fn(async (): Promise<string[]> => {
      throw new Error('500')
    })
    const hookFetcher = jest.fn(async () => ['real-event'])

    prefetchToGlobalCache<string[]>(cacheKey, failing)
    await waitFor(() => expect(failing).toHaveBeenCalled())
    // Nothing was cached as a success
    expect(getQueryClient().getQueryData([cacheKey])).toBeUndefined()

    renderProbe(cacheKey, hookFetcher)

    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('["real-event"]'))
    expect(hookFetcher).toHaveBeenCalled()
  })

  it('a prefetch that resolves to [] IS treated as success and the hook reuses it', async () => {
    // This is the failure mode the calendar prefetches used to have: swallowing a
    // 500 into [] is indistinguishable from a genuinely empty calendar.
    const cacheKey = nextKey()
    const swallowing = jest.fn(async (): Promise<string[]> => [])
    const hookFetcher = jest.fn(async () => ['real-event'])

    prefetchToGlobalCache<string[]>(cacheKey, swallowing)
    await waitFor(() => expect(getQueryClient().getQueryData([cacheKey])).toEqual([]))

    renderProbe(cacheKey, hookFetcher)

    expect(screen.getByTestId('out').textContent).toBe('[]')
    expect(hookFetcher).not.toHaveBeenCalled()
  })

  it('a resolving prefetch is reused without a second request', async () => {
    const cacheKey = nextKey()
    const prefetcher = jest.fn(async () => ['prefetched'])
    const hookFetcher = jest.fn(async () => ['should-not-run'])

    prefetchToGlobalCache<string[]>(cacheKey, prefetcher)
    await waitFor(() => expect(getQueryClient().getQueryData([cacheKey])).toEqual(['prefetched']))

    renderProbe(cacheKey, hookFetcher)

    expect(screen.getByTestId('out').textContent).toBe('["prefetched"]')
    expect(hookFetcher).not.toHaveBeenCalled()
  })
})
