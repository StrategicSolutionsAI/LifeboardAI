import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDataCache } from '../use-data-cache'

/**
 * The `enabled` passthrough exists so a query can wait for its inputs (see the
 * gmail-messages query on /email, which used to fetch the whole list twice per
 * visit). These tests pin the two things callers depend on: a disabled query
 * makes no request, and omitting the option changes nothing.
 */

let key = 0

function Probe({ enabled, fetcher }: { enabled?: boolean; fetcher: () => Promise<string> }) {
  const { data, loading, fetching } = useDataCache<string>(`probe-${key}`, fetcher, {
    ttl: 300_000,
    ...(enabled !== undefined && { enabled }),
  })
  return <span data-testid="state">{`loading=${loading} fetching=${fetching} data=${String(data)}`}</span>
}

function renderProbe(props: { enabled?: boolean; fetcher: () => Promise<string> }) {
  key += 1
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrap = (p: typeof props) => (
    <QueryClientProvider client={client}>
      <Probe {...p} />
    </QueryClientProvider>
  )
  const utils = render(wrap(props))
  return { ...utils, setProps: (p: typeof props) => utils.rerender(wrap(p)) }
}

const state = () => screen.getByTestId('state').textContent

describe('useDataCache enabled option', () => {
  it('makes no request while disabled', () => {
    const fetcher = jest.fn(async () => 'value')
    renderProbe({ enabled: false, fetcher })

    expect(fetcher).not.toHaveBeenCalled()
    // Disabled means idle, not loading — callers must not render a spinner off
    // `loading` alone while waiting for the gate to open.
    expect(state()).toBe('loading=false fetching=false data=null')
  })

  it('fetches exactly once when the gate opens', async () => {
    const fetcher = jest.fn(async () => 'value')
    const { setProps } = renderProbe({ enabled: false, fetcher })

    setProps({ enabled: true, fetcher })

    await waitFor(() => expect(state()).toContain('data=value'))
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('fetches immediately when the option is omitted', async () => {
    const fetcher = jest.fn(async () => 'value')
    renderProbe({ fetcher })

    await waitFor(() => expect(state()).toContain('data=value'))
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
