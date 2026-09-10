import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query-client'
import { prefetchAllTasks } from '@/lib/prefetch-tasks'
import { useTaskFetcher } from '../use-task-fetcher'
import type { TaskSharedState } from '../task-helpers'
import type { Task } from '@/types/tasks'

const toast = jest.fn()
jest.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }))
const task = { id: 'task-1', content: 'First task', due: { date: '2026-09-10' }, source: 'supabase' } as Task
const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300, status,
  json: async () => body, headers: { get: () => null },
}) as unknown as Response

function sharedState(): TaskSharedState {
  const state: TaskSharedState = {
    todoistConnectedRef: { current: null }, nocacheRef: { current: false },
    localUpdateTimestamps: { current: new Set() },
    setTodoistConnected: value => { state.todoistConnectedRef.current = value },
  }
  return state
}
function mount(date = '2026-09-10') {
  const state = sharedState()
  return renderHook(({ day }) => useTaskFetcher(day, state), {
    initialProps: { day: date },
    wrapper: ({ children }) => <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>,
  })
}

beforeEach(() => {
  localStorage.clear()
  getQueryClient().clear()
  getQueryClient().setDefaultOptions({ queries: { retry: false } })
  global.fetch = jest.fn(async (url) => String(url).includes('/todoist/')
    ? response({ tasks: [] }) : response({ tasks: [task] }))
})
afterEach(() => getQueryClient().clear())

it('reuses resolved prefetch for daily and all views, including date navigation', async () => {
  prefetchAllTasks()
  await waitFor(() => expect(getQueryClient().getQueryData(['tasks-all-open'])).toEqual([task]))
  const { result, rerender } = mount()
  await waitFor(() => expect(result.current.dailyTasks).toEqual([task]))
  rerender({ day: '2026-09-11' })
  await waitFor(() => expect(result.current.dailyTasks).toEqual([]))
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('shares an in-flight prefetch with both task views', async () => {
  let resolve!: (value: Response) => void
  const pending = new Promise<Response>(r => { resolve = r })
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/todoist/') ? response({ tasks: [] }) : pending)
  prefetchAllTasks()
  const { result } = mount()
  await act(async () => resolve(response({ tasks: [task] })))
  await waitFor(() => expect(result.current.dailyTasks).toEqual([task]))
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('does not retry a successful empty task response when Todoist is disconnected', async () => {
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/todoist/') ? response({}, 400) : response({ tasks: [] }))
  const { result } = mount()
  await waitFor(() => expect(result.current.dailyTasks).toEqual([]))
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('refreshes both views after a write without serving the fresh prefetch or duplicating requests', async () => {
  prefetchAllTasks()
  await waitFor(() => expect(getQueryClient().getQueryData(['tasks-all-open'])).toEqual([task]))
  const { result } = mount()
  await waitFor(() => expect(result.current.dailyTasks).toEqual([task]))
  jest.mocked(fetch).mockClear()
  const updated = { ...task, content: 'Updated task' }
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/todoist/') ? response({ tasks: [] }) : response({ tasks: [updated] }))
  await act(async () => { result.current.refetchDaily(); result.current.refetchAll() })
  await waitFor(() => {
    expect(result.current.allTasks).toEqual([updated])
    expect(result.current.dailyTasks).toEqual([updated])
  })
  expect(fetch).toHaveBeenCalledTimes(2)
})

it.each([500, 401])('does not cache a failed prefetch (%s) as an empty account', async status => {
  jest.mocked(fetch).mockResolvedValue(response({}, status))
  prefetchAllTasks()
  await waitFor(() => expect(getQueryClient().getQueryState(['tasks-all-open'])?.fetchStatus).toBe('idle'))
  expect(getQueryClient().getQueryData(['tasks-all-open'])).toBeUndefined()
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/todoist/') ? response({ tasks: [] }) : response({ tasks: [task] }))
  const { result } = mount()
  await waitFor(() => expect(result.current.allTasks).toEqual([task]))
})

it('discards a pre-write response that arrives after a forced refresh', async () => {
  let finishOldRead!: (value: Response) => void
  const oldRead = new Promise<Response>(resolve => { finishOldRead = resolve })
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/todoist/') ? response({ tasks: [] }) : oldRead)
  const { result } = mount()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  const updated = { ...task, content: 'After write' }
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/todoist/') ? response({ tasks: [] }) : response({ tasks: [updated] }))
  await act(async () => { await result.current.refetchAll() })
  await waitFor(() => expect(result.current.dailyTasks).toEqual([updated]))
  await act(async () => finishOldRead(response({ tasks: [task] })))
  expect(result.current.allTasks).toEqual([updated])
  expect(result.current.dailyTasks).toEqual([updated])
  expect(fetch).toHaveBeenCalledTimes(4)
})

it('starts a new snapshot for a second write while the previous refresh is pending', async () => {
  const { result } = mount()
  await waitFor(() => expect(result.current.allTasks).toEqual([task]))
  let finishFirstRefresh!: (value: Response) => void
  const firstRefresh = new Promise<Response>(resolve => { finishFirstRefresh = resolve })
  jest.mocked(fetch).mockClear()
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/todoist/') ? response({ tasks: [] }) : firstRefresh)
  act(() => { void result.current.refetchAll() })
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  const updated = { ...task, content: 'Second write' }
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/todoist/') ? response({ tasks: [] }) : response({ tasks: [updated] }))
  await act(async () => { await result.current.refetchAll() })
  await waitFor(() => expect(result.current.dailyTasks).toEqual([updated]))
  await act(async () => finishFirstRefresh(response({ tasks: [task] })))
  expect(result.current.allTasks).toEqual([updated])
  expect(fetch).toHaveBeenCalledTimes(4)
})

it('keeps local open tasks in prefetch while remote records win duplicate IDs', async () => {
  const local = { ...task, id: 'local-1', source: 'local' }
  localStorage.setItem('lifeboard_local_tasks', JSON.stringify([local, { ...task, content: 'Old local version' }, { ...local, id: 'done', completed: true }]))
  prefetchAllTasks()
  await waitFor(() => expect(getQueryClient().getQueryData(['tasks-all-open'])).toEqual([local, task]))
})

it.each(['network', 'malformed', 'provider'])('leaves failed %s prefetch recoverable', async kind => {
  jest.mocked(fetch).mockImplementation(async url => {
    if (kind === 'network') throw new TypeError('Failed to fetch')
    if (kind === 'provider' && String(url).includes('/todoist/')) return response({}, 503)
    return response(kind === 'malformed' ? { unexpected: true } : { tasks: [task] })
  })
  prefetchAllTasks()
  await waitFor(() => expect(getQueryClient().getQueryState(['tasks-all-open'])?.fetchStatus).toBe('idle'))
  expect(getQueryClient().getQueryData(['tasks-all-open'])).toBeUndefined()
})

it('keeps simultaneous daily views usable when one refresh cancels their shared initial read', async () => {
  let finishOldRead!: (value: Response) => void
  const oldRead = new Promise<Response>(resolve => { finishOldRead = resolve })
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/todoist/') ? response({ tasks: [] }) : oldRead)
  const first = mount('2026-09-10')
  const second = mount('2026-09-11')
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/todoist/') ? response({ tasks: [] }) : response({ tasks: [task] }))
  await act(async () => { await first.result.current.refetchAll() })
  await waitFor(() => {
    expect(first.result.current.dailyTasks).toEqual([task])
    expect(second.result.current.dailyTasks).toEqual([])
    expect(second.result.current.dailyError).toBeNull()
  })
  await act(async () => finishOldRead(response({ tasks: [] })))
})

it('recovers when a pending prefetch fails after consumers mount, using the mounted fetcher on retry', async () => {
  getQueryClient().setDefaultOptions({ queries: { retry: 1, retryDelay: 0 } })
  let failPrefetch!: (value: Response) => void
  const pending = new Promise<Response>(resolve => { failPrefetch = resolve })
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/todoist/') ? response({ tasks: [] }) : pending)
  prefetchAllTasks()
  const { result } = mount()
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/todoist/') ? response({}, 400) : response({ tasks: [task] }))
  await act(async () => failPrefetch(response({}, 503)))
  await waitFor(() => {
    expect(result.current.dailyTasks).toEqual([task])
    expect(result.current.allTasks).toEqual([task])
  })
  expect(fetch).toHaveBeenCalledTimes(4)
})
