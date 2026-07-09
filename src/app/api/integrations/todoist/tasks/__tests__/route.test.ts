/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server'

const mockGetTodoistToken = jest.fn()

jest.mock('@/lib/todoist/helpers', () => ({
  ...jest.requireActual('@/lib/todoist/helpers'),
  getTodoistToken: (...args: any[]) => mockGetTodoistToken(...args),
}))

// Bypass auth plumbing — these tests cover the handler's own branches.
jest.mock('@/lib/api-utils', () => ({
  ...jest.requireActual('@/lib/api-utils'),
  withAuth: (handler: any) => (req: NextRequest) =>
    handler(req, { supabase: {}, user: { id: 'test-user-id' } }),
}))

import { GET } from '../route'

describe('GET /api/integrations/todoist/tasks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 400 when neither date nor all param is provided', async () => {
    const res = (await GET(new NextRequest('http://localhost:3000/api/integrations/todoist/tasks'))) as NextResponse
    expect(res.status).toBe(400)
  })

  // Regression: this used to be a 400 ("Todoist not connected"), which every
  // user without Todoist saw as a failed request on each dashboard load.
  it('answers not-connected with an empty 200 instead of a 400', async () => {
    mockGetTodoistToken.mockResolvedValue({
      response: NextResponse.json({ error: 'Todoist not connected' }, { status: 400 }),
      notConnected: true,
    })

    const res = (await GET(new NextRequest('http://localhost:3000/api/integrations/todoist/tasks?all=true'))) as NextResponse
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ tasks: [], connected: false })
  })

  it('still surfaces real token-lookup failures', async () => {
    mockGetTodoistToken.mockResolvedValue({
      response: NextResponse.json({ error: 'Database error' }, { status: 500 }),
    })

    const res = (await GET(new NextRequest('http://localhost:3000/api/integrations/todoist/tasks?all=true'))) as NextResponse
    expect(res.status).toBe(500)
  })

  it('returns tasks from the Todoist API on the happy path', async () => {
    mockGetTodoistToken.mockResolvedValue({ token: 'todoist-token' })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: '1', content: 'Water plants', position: 1 }],
    }) as any

    const res = (await GET(new NextRequest('http://localhost:3000/api/integrations/todoist/tasks?all=true&nocache=1'))) as NextResponse
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.tasks).toHaveLength(1)
    expect(data.tasks[0].content).toBe('Water plants')
  })
})
