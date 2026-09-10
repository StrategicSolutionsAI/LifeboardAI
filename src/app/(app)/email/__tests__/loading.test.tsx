import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import EmailPage from '../page.client'

const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response
let client: QueryClient
beforeEach(() => {
  localStorage.clear()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => client.clear())
function renderPage() {
  return render(<QueryClientProvider client={client}><EmailPage /></QueryClientProvider>)
}

it('loads messages without waiting for labels and fetches labels only for the resolved account', async () => {
  let finishLabels!: (value: Response) => void
  const pendingLabels = new Promise<Response>(resolve => { finishLabels = resolve })
  localStorage.setItem('gmail-selected-account', 'second@example.test')
  global.fetch = jest.fn(async url => {
    const path = String(url)
    if (path.includes('/status')) return response({ connected: true })
    if (path.includes('/accounts')) return response({ accounts: ['first@example.test', 'second@example.test'] })
    if (path.includes('/labels')) return pendingLabels
    return response({ messages: [], nextPageToken: null })
  })
  renderPage()
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/email/messages?')))
  const calls = jest.mocked(fetch).mock.calls.map(([url]) => String(url))
  expect(calls.filter(url => url.includes('/labels'))).toEqual(['/api/email/labels?account=second%40example.test'])
  expect(calls.find(url => url.includes('/messages'))).toContain('account=second%40example.test')
  await act(async () => finishLabels(response({ labels: [] })))
})

it('does not request labels or messages when Gmail is disconnected', async () => {
  global.fetch = jest.fn(async url => response(String(url).includes('/status') ? { connected: false } : { accounts: [] }))
  renderPage()
  await screen.findByText('Connect Gmail')
  expect(jest.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
    '/api/integrations/status?provider=gmail', '/api/email/accounts',
  ])
})

it('falls back from a removed account and ignores late labels after switching accounts', async () => {
  let finishOldLabels!: (value: Response) => void
  const oldLabels = new Promise<Response>(resolve => { finishOldLabels = resolve })
  localStorage.setItem('gmail-selected-account', 'removed@example.test')
  global.fetch = jest.fn(async url => {
    const path = String(url)
    if (path.includes('/status')) return response({ connected: true })
    if (path.includes('/accounts')) return response({ accounts: ['first@example.test', 'second@example.test'] })
    if (path.includes('/labels?account=first')) return oldLabels
    if (path.includes('/labels?account=second')) return response({ labels: [{ id: 'new', name: 'Current account label', type: 'user' }] })
    return response({ messages: [], nextPageToken: null })
  })
  renderPage()
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('messages?maxResults=20&q=in%3Ainbox&account=first%40example.test')))
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'second@example.test' } })
  await screen.findByText('Current account label')
  await act(async () => finishOldLabels(response({ labels: [{ id: 'old', name: 'Previous account label', type: 'user' }] })))
  expect(screen.queryByText('Previous account label')).not.toBeInTheDocument()
  expect(screen.getByText('Current account label')).toBeInTheDocument()
})
