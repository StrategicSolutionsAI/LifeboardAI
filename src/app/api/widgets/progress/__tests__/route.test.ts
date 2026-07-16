/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '../route'

const upsertMock = jest.fn(async () => ({ error: null }))

const supabaseMockInstance = {
  auth: {
    getUser: jest.fn(),
    // No session → getUserCached always falls through to getUser
    getSession: jest.fn(async () => ({ data: { session: null } })),
  },
  from: jest.fn(() => ({
    upsert: upsertMock,
  })),
}

jest.mock('@/utils/supabase/server', () => ({
  supabaseServer: jest.fn(() => supabaseMockInstance),
}))

function postRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/widgets/progress', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/widgets/progress', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    upsertMock.mockResolvedValue({ error: null })
  })

  it('returns 401 when user is not authenticated', async () => {
    supabaseMockInstance.auth.getUser.mockResolvedValue({ data: { user: null } })

    const response = await POST(postRequest({ rows: [] }))

    expect(response.status).toBe(401)
  })

  it('rejects a body without rows', async () => {
    supabaseMockInstance.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })

    const response = await POST(postRequest({}))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  // Regression: weight logs carry fractional values (122.6); the DB column is
  // numeric and the route must pass the value through unrounded.
  it('upserts fractional values unchanged', async () => {
    supabaseMockInstance.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })

    const response = await POST(
      postRequest({ rows: [{ widget_instance_id: 'w1', date: '2026-07-16', value: 122.6 }] })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(upsertMock).toHaveBeenCalledWith(
      [{ user_id: 'u1', widget_instance_id: 'w1', date: '2026-07-16', value: 122.6 }],
      { onConflict: 'user_id,widget_instance_id,date' }
    )
  })
})
