/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET } from '../route'

type Row = Record<string, unknown>

// Minimal PostgREST stand-in: applies eq/in filters to in-memory rows so the
// test asserts which rows the calendar actually receives, not which calls ran.
function makeQuery(rows: Row[]) {
  let result = rows
  const query = {
    select: () => query,
    eq: (col: string, val: unknown) => {
      result = result.filter((r) => r[col] === val)
      return query
    },
    in: (col: string, vals: unknown[]) => {
      result = result.filter((r) => vals.includes(r[col]))
      return query
    },
    order: () => query,
    then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
      Promise.resolve({ data: result, error: null }).then(resolve),
  }
  return query
}

const tables: Record<string, Row[]> = {
  calendar_events: [
    { id: 'ev-upload', user_id: 'user-1', source: 'uploaded_calendar', title: 'School play', task_id: 't-1' },
    { id: 'ev-ai', user_id: 'user-1', source: 'manual', title: 'Dentist', task_id: 't-2' },
    { id: 'ev-other-user', user_id: 'user-2', source: 'manual', title: 'Not mine', task_id: 't-3' },
  ],
  calendar_imports: [],
}

const supabaseMock = {
  auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
  from: (table: string) => makeQuery(tables[table] ?? []),
}

jest.mock('@/utils/supabase/server', () => ({
  supabaseServer: jest.fn(() => supabaseMock),
}))

describe('GET /api/calendar/upload', () => {
  it('returns events the assistant created (source=manual) alongside imported ones', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/calendar/upload'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.events.map((e: Row) => e.id).sort()).toEqual(['ev-ai', 'ev-upload'])
  })
})
