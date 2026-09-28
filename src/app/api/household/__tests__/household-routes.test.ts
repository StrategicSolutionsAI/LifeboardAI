/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST as createHousehold } from '../route'
import { POST as invite } from '../invite/route'
import { POST as join } from '../join/route'
import { PUT as saveRoster } from '../roster/route'

// Each `from(table)` call pops the next queued result for that table; every
// builder method returns the builder, and awaiting it (or .single/.maybeSingle)
// resolves the queued result. Inserts/updates are recorded for assertions.
type Result = { data: unknown; error: unknown }
const queued: Record<string, Result[]> = {}
const writes: Array<{ table: string; op: string; payload: unknown }> = []
const rpc = jest.fn()
const sendInviteViaGmail = jest.fn()

function builder(table: string) {
  const result = () => queued[table]?.shift() ?? { data: null, error: null }
  const b: any = {}
  for (const m of ['select', 'eq', 'neq', 'or', 'limit', 'order']) b[m] = () => b
  for (const op of ['insert', 'update', 'upsert']) {
    b[op] = (payload: unknown) => { writes.push({ table, op, payload }); return b }
  }
  b.single = b.maybeSingle = () => Promise.resolve(result())
  b.then = (resolve: (r: Result) => unknown) => Promise.resolve(result()).then(resolve)
  return b
}

const supabaseMock = {
  auth: {
    getUser: jest.fn(),
    getSession: jest.fn(async () => ({ data: { session: null } })),
  },
  from: (table: string) => builder(table),
  rpc: (...args: unknown[]) => rpc(...args),
}

jest.mock('@/utils/supabase/server', () => ({ supabaseServer: jest.fn(() => supabaseMock) }))
jest.mock('@/lib/household/invite-email', () => ({
  sendInviteViaGmail: (...args: unknown[]) => sendInviteViaGmail(...args),
}))

const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'alex@example.test', user_metadata: { full_name: 'Alex' } }
const TOKEN = '22222222-2222-4222-8222-222222222222'
const HOUSEHOLD = '33333333-3333-4333-8333-333333333333'

const req = (url: string, method: string, body: unknown) =>
  new NextRequest(`http://localhost:3000${url}`, { method, body: JSON.stringify(body), headers: { host: 'localhost:3000' } })
const signedIn = () => supabaseMock.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null })
const signedOut = () => supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
const queue = (table: string, ...results: Result[]) => { queued[table] = [...(queued[table] ?? []), ...results] }

beforeEach(() => {
  jest.clearAllMocks()
  for (const key of Object.keys(queued)) delete queued[key]
  writes.length = 0
})

describe('POST /api/household', () => {
  it('401 when signed out', async () => {
    signedOut()
    expect((await createHousehold(req('/api/household', 'POST', { name: 'Us' }))).status).toBe(401)
  })

  it('400 for an empty name', async () => {
    signedIn()
    expect((await createHousehold(req('/api/household', 'POST', { name: '' }))).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('creates through the RPC and seeds the shared roster', async () => {
    signedIn()
    rpc.mockResolvedValue({ data: HOUSEHOLD, error: null })
    queue('households', { data: null, error: null }, { data: { id: HOUSEHOLD, name: 'Us', created_by: USER.id, family_roster: [] }, error: null })
    const roster = [{ id: 'kid-1', name: 'Benji', relationship: 'child', avatarColor: '#64B5F6', createdAt: '2026-09-01T00:00:00Z' }]

    const res = await createHousehold(req('/api/household', 'POST', { name: 'Us', roster }))

    expect(res.status).toBe(201)
    expect(rpc).toHaveBeenCalledWith('create_household', { p_name: 'Us', p_display_name: 'Alex' })
    expect(writes).toContainEqual({ table: 'households', op: 'update', payload: { family_roster: roster } })
  })

  it('409 when already in a household', async () => {
    signedIn()
    rpc.mockResolvedValue({ data: null, error: { message: 'ALREADY_MEMBER' } })
    expect((await createHousehold(req('/api/household', 'POST', { name: 'Us' }))).status).toBe(409)
  })
})

describe('POST /api/household/invite', () => {
  it('401 when signed out', async () => {
    signedOut()
    expect((await invite(req('/api/household/invite', 'POST', { email: 'sam@example.test' }))).status).toBe(401)
  })

  it('400 for an invalid email', async () => {
    signedIn()
    expect((await invite(req('/api/household/invite', 'POST', { email: 'nope' }))).status).toBe(400)
  })

  it('403 for a non-admin', async () => {
    signedIn()
    queue('household_members', { data: null, error: null })
    expect((await invite(req('/api/household/invite', 'POST', { email: 'sam@example.test' }))).status).toBe(403)
  })

  it('returns a join link and reports whether Gmail sent it', async () => {
    signedIn()
    queue(
      'household_members',
      { data: { household_id: HOUSEHOLD, display_name: 'Alex' }, error: null }, // admin lookup
      { data: null, error: null }, // no duplicate
      { data: { id: 'm-2', household_id: HOUSEHOLD, status: 'pending', role: 'member', invited_email: 'sam@example.test', invite_token: TOKEN }, error: null },
    )
    queue('households', { data: { name: 'The Barretts' }, error: null })
    sendInviteViaGmail.mockResolvedValue(false)

    const res = await invite(req('/api/household/invite', 'POST', { email: 'Sam@Example.test' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.inviteUrl).toBe(`http://localhost:3000/join/${TOKEN}`)
    expect(body.emailed).toBe(false)
    expect(sendInviteViaGmail).toHaveBeenCalledWith(supabaseMock, USER.id, expect.objectContaining({
      to: 'sam@example.test', householdName: 'The Barretts', inviteUrl: body.inviteUrl,
    }))
  })

  it('409 for an email that already has an invite', async () => {
    signedIn()
    queue('household_members', { data: { household_id: HOUSEHOLD }, error: null }, { data: { status: 'pending' }, error: null })
    expect((await invite(req('/api/household/invite', 'POST', { email: 'sam@example.test' }))).status).toBe(409)
  })
})

describe('POST /api/household/join', () => {
  it('401 when signed out', async () => {
    signedOut()
    expect((await join(req('/api/household/join', 'POST', { token: TOKEN }))).status).toBe(401)
  })

  it('400 for a malformed token', async () => {
    signedIn()
    expect((await join(req('/api/household/join', 'POST', { token: 'abc' }))).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('accepts the invite and clears the pending-invite cookie', async () => {
    signedIn()
    rpc.mockResolvedValue({ data: HOUSEHOLD, error: null })
    const res = await join(req('/api/household/join', 'POST', { token: TOKEN }))
    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('accept_household_invite', { p_token: TOKEN })
    expect(res.headers.get('set-cookie')).toMatch(/lb_pending_invite=;/)
  })

  it.each([
    ['INVITE_NOT_FOUND', 404],
    ['INVITE_USED', 409],
    ['ALREADY_MEMBER', 409],
  ])('maps %s to %i', async (code, status) => {
    signedIn()
    rpc.mockResolvedValue({ data: null, error: { message: code } })
    expect((await join(req('/api/household/join', 'POST', { token: TOKEN }))).status).toBe(status)
  })
})

describe('PUT /api/household/roster', () => {
  const roster = [{ id: 'kid-1', name: 'Benji', relationship: 'child', avatarColor: '#64B5F6', createdAt: '2026-09-01T00:00:00Z' }]

  it('401 when signed out', async () => {
    signedOut()
    expect((await saveRoster(req('/api/household/roster', 'PUT', { roster }))).status).toBe(401)
  })

  it('400 for an invalid roster entry', async () => {
    signedIn()
    expect((await saveRoster(req('/api/household/roster', 'PUT', { roster: [{ name: 'x' }] }))).status).toBe(400)
  })

  it('404 outside a household', async () => {
    signedIn()
    queue('household_members', { data: null, error: null })
    expect((await saveRoster(req('/api/household/roster', 'PUT', { roster }))).status).toBe(404)
  })
})
