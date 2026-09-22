import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import EmailPage from '../page.client'

const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response
const failure = () => ({ ok: false, status: 500, json: async () => ({}) }) as Response
let client: QueryClient
beforeEach(() => {
  localStorage.clear()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => client.clear())

it('shows a recoverable error state when the inbox fails to load, and retries from it', async () => {
  let messagesFail = true
  global.fetch = jest.fn(async url => {
    const path = String(url)
    if (path.includes('/status')) return response({ connected: true })
    if (path.includes('/accounts')) return response({ accounts: ['reader@example.test'] })
    if (path.includes('/labels')) return response({ labels: [] })
    return messagesFail ? failure() : response({ messages: [], nextPageToken: null })
  })
  render(<QueryClientProvider client={client}><EmailPage /></QueryClientProvider>)

  await screen.findByText("Couldn't load your inbox")
  expect(screen.queryByText(/Failed to load emails/)).not.toBeInTheDocument()

  messagesFail = false
  fireEvent.click(screen.getByRole('button', { name: /try again/i }))
  await screen.findByText('Nothing here yet.')
  expect(screen.queryByText("Couldn't load your inbox")).not.toBeInTheDocument()
})
