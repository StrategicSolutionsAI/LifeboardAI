import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import EmailPage from '../page.client'

const message = {
  id: 'layout-message', threadId: 'layout-thread',
  from: 'Neighborhood association with a long name <sender@example.test>',
  to: 'reader@example.test', cc: '', date: '2026-09-10T12:00:00Z',
  subject: 'An informative subject that needs room on a phone',
  snippet: 'A preview stays available below the subject.',
  labelIds: ['INBOX'], isUnread: false, attachments: [],
  textBody: 'Fixture message body.', htmlBody: '',
}
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response
let client: QueryClient

beforeEach(() => {
  localStorage.clear()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  global.fetch = jest.fn(async (url, init) => {
    const path = String(url)
    if (init?.method && init.method !== 'GET') return response({ success: true })
    if (path.includes('/status')) return response({ connected: true })
    if (path.includes('/accounts')) return response({ accounts: ['reader@example.test'] })
    if (path.includes('/labels')) return response({ labels: [{ id: 'INBOX', name: 'Inbox', type: 'system' }] })
    return response({ messages: [message], nextPageToken: null })
  })
})
afterEach(() => client.clear())

it('keeps selection and starring independent from opening the responsive message row', async () => {
  render(<QueryClientProvider client={client}><EmailPage /></QueryClientProvider>)
  const open = await screen.findByRole('button', { name: `Open email: ${message.subject}` })
  expect(open).toHaveTextContent(message.subject)
  expect(open).toHaveTextContent(message.snippet)
  fireEvent.click(screen.getByRole('checkbox', { name: `Select email: ${message.subject}` }))
  expect(screen.getByText('1 selected')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Star email' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/modify'), expect.objectContaining({ method: 'PATCH' })))
  expect(jest.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/threads/'))).toBe(false)
  fireEvent.click(open)
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/email/threads/layout-thread?account=reader%40example.test'))
  expect(await screen.findByText('Fixture message body.')).toBeInTheDocument()
})

it('exposes a labelled compose action after the mailbox connects', async () => {
  render(<QueryClientProvider client={client}><EmailPage /></QueryClientProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Compose' }))
  expect(await screen.findByText('New Message')).toBeInTheDocument()
})
