import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FindTasksModal } from '../components/find-tasks-modal'

jest.mock('@/hooks/use-data-cache', () => ({ invalidateTaskCaches: jest.fn() }))
jest.mock('@/hooks/use-buckets', () => ({ useBuckets: () => ({ buckets: ['Family'] }) }))

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response

const extracted = [
  { title: 'Return permission slip', description: '', dueDate: '2026-09-30', dueTime: null, location: null, suggestedBucket: 'Family', sourceEmailSubject: 'Zoo trip', confidence: 0.9 },
  { title: 'Checkup with Dr. Patel', description: '', dueDate: '2026-10-06', dueTime: '15:30', location: null, suggestedBucket: 'Unknown', sourceEmailSubject: 'Reminder', confidence: 0.85 },
]

it('adds selected tasks and, on a partial failure, keeps only the failed one so a retry cannot duplicate', async () => {
  const posted: Array<Record<string, unknown>> = []
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).startsWith('/api/email/ai/extract-tasks')) return json(200, { tasks: extracted, totalScanned: 2 })
    const body = JSON.parse(String(init?.body))
    posted.push(body)
    return body.content === 'Checkup with Dr. Patel' && posted.length <= 2 ? json(500, {}) : json(201, {})
  }) as typeof fetch

  render(<FindTasksModal messageIds={['m1', 'm2']} onClose={() => {}} />)

  fireEvent.click(await screen.findByRole('button', { name: 'Add 2 tasks' }))
  await screen.findByText(/1 task could not be added \(1 added\)/)

  expect(posted).toEqual([
    { content: 'Return permission slip', due_date: '2026-09-30', hour_slot: null, bucket: 'Family' },
    // A bucket the user doesn't have is dropped rather than invented.
    { content: 'Checkup with Dr. Patel', due_date: '2026-10-06', hour_slot: 'hour-3:30PM', bucket: null },
  ])
  expect(screen.queryByText('Return permission slip')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Add 1 task' }))
  await screen.findByText('Added 2 tasks')
  await waitFor(() => expect(posted.map((p) => p.content)).toEqual([
    'Return permission slip', 'Checkup with Dr. Patel', 'Checkup with Dr. Patel',
  ]))
})
