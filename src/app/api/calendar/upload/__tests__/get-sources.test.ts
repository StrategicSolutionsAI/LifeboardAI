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
    // "a.eq.x,b.eq.y" — any clause matching keeps the row
    or: (filters: string) => {
      const clauses = filters.split(',').map((c) => c.split('.eq.').map((part) => part.trim()))
      result = result.filter((r) => clauses.some(([col, val]) => String(r[col]) === val))
      return query
    },
    order: () => query,
    limit: () => query,
    maybeSingle: () => Promise.resolve({ data: result[0] ?? null, error: null }),
    then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
      Promise.resolve({ data: result, error: null }).then(resolve),
  }
  return query
}

const tables: Record<string, Row[]> = {
  household_members: [
    { user_id: 'user-1', household_id: 'hh-1', status: 'active' },
  ],
  calendar_events: [
    { id: 'ev-upload', user_id: 'user-1', source: 'uploaded_calendar', title: 'School play', task_id: 't-1' },
    { id: 'ev-ai', user_id: 'user-1', source: 'manual', title: 'Dentist', task_id: 't-2' },
    { id: 'ev-partner', user_id: 'user-2', household_id: 'hh-1', source: 'uploaded_calendar', title: 'Partner soccer', task_id: 't-4' },
    { id: 'ev-other-user', user_id: 'user-3', household_id: 'hh-2', source: 'manual', title: 'Not mine', task_id: 't-3' },
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
  it('returns events the assistant created (source=manual) and household events, never outsiders', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/calendar/upload'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.events.map((e: Row) => e.id).sort()).toEqual(['ev-ai', 'ev-partner', 'ev-upload'])
  })
})
