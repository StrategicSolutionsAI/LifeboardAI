/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const calls: Array<[string, unknown[]]> = []
const rows = [{ id: 't1', content: 'Laundry', completed: true, due_date: '2026-09-28', updated_at: '2026-09-28T20:00:00Z' }]
const b: any = {}
for (const m of ['select', 'or', 'eq', 'order', 'range']) b[m] = (...args: unknown[]) => { calls.push([m, args]); return b }
b.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null })
const supabaseMock = {
  auth: { getUser: jest.fn(), getSession: jest.fn(async () => ({ data: { session: null } })) },
  from: () => b,
}
jest.mock('@/utils/supabase/server', () => ({ supabaseServer: jest.fn(() => supabaseMock) }))
jest.mock('@/lib/household/scope', () => ({
  getDataScope: jest.fn(async () => ({ userId: 'u1', householdId: null })),
  ownedOrShared: () => 'user_id.eq.u1',
}))

import { GET } from '../route'

const get = (qs: string) => GET(new NextRequest(`http://localhost:3000/api/tasks?${qs}`))
const signedIn = () => supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

beforeEach(() => { jest.clearAllMocks(); calls.length = 0 })

describe('GET /api/tasks', () => {
  it('401 when signed out', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await get('all=true')).status).toBe(401)
  })

  it('400 for a completedSince that is not a timestamp', async () => {
    signedIn()
    expect((await get('all=true&completedSince=yesterday),completed.eq.true')).status).toBe(400)
  })

  it('returns only open tasks by default', async () => {
    signedIn()
    const res = await get('all=true')
    expect(res.status).toBe(200)
    expect(calls).toContainEqual(['eq', ['completed', false]])
  })

  it('also returns tasks finished since the client-supplied instant, scoped to the household', async () => {
    signedIn()
    const since = '2026-09-28T05:00:00.000Z' // local midnight in Chicago
    const res = await get(`all=true&completedSince=${encodeURIComponent(since)}`)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(calls).toContainEqual(['or', ['user_id.eq.u1']])
    expect(calls).toContainEqual(['or', [`completed.eq.false,updated_at.gte."${since}"`]])
    expect(calls.some(([m, a]) => m === 'eq' && a[0] === 'completed')).toBe(false)
    expect(body.tasks[0]).toMatchObject({ id: 't1', completed: true })
  })
})
