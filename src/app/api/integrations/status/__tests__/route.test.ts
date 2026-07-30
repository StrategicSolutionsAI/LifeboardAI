/**
 * @jest-environment node
 */
import { GET } from '../route'

// The route filters rows with .eq('user_id').in('provider', [...]) — capture the
// requested provider list so the batch path can be asserted on.
let requestedProviders: string[] = []
let rowsResult: { data: any[] | null; error: { message: string } | null } = { data: [], error: null }

const inMock = jest.fn(async (_col: string, list: string[]) => {
  requestedProviders = list
  return rowsResult
})

const supabaseMockInstance = {
  auth: {
    getUser: jest.fn(),
    // No session → getUserCached always falls through to getUser
    getSession: jest.fn(async () => ({ data: { session: null } })),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        in: (col: string, list: string[]) => inMock(col, list),
      })),
    })),
  })),
}

jest.mock('@/utils/supabase/server', () => ({
  supabaseServer: jest.fn(() => supabaseMockInstance),
}))

function req(query: string) {
  return new Request(`http://localhost:3000/api/integrations/status${query}`)
}

describe('/api/integrations/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    requestedProviders = []
    rowsResult = { data: [], error: null }
    supabaseMockInstance.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
  })

  it('returns 401 when the user is not authenticated', async () => {
    supabaseMockInstance.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(req('?provider=todoist') as any)
    expect(res.status).toBe(401)
  })

  it('returns 400 when neither provider nor providers is supplied', async () => {
    const res = await GET(req('') as any)
    expect(res.status).toBe(400)
  })

  it('single-provider form returns the flat status shape', async () => {
    rowsResult = {
      data: [{ id: 'i1', provider: 'todoist', access_token: 'tok', refresh_token: null, token_data: {}, updated_at: '2026-07-01T00:00:00Z' }],
      error: null,
    }
    const res = await GET(req('?provider=todoist') as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.connected).toBe(true)
    expect(body.integrationId).toBe('i1')
    expect(requestedProviders).toEqual(['todoist'])
  })

  it('batches the whole set into one query and keys the result by provider', async () => {
    rowsResult = {
      data: [{ id: 'i1', provider: 'todoist', access_token: 'tok', refresh_token: null, token_data: {}, updated_at: null }],
      error: null,
    }
    const res = await GET(req('?providers=todoist,gmail,fitbit') as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    // One query covering all three, not one per provider
    expect(supabaseMockInstance.from).toHaveBeenCalledTimes(1)
    expect(requestedProviders).toEqual(['todoist', 'gmail', 'fitbit'])
    expect(body.statuses.todoist.connected).toBe(true)
    // Providers with no row come back as a normal disconnected state, not an error
    expect(body.statuses.gmail).toEqual({ connected: false, lastUpdated: null, integrationId: null })
    expect(body.statuses.fitbit.connected).toBe(false)
  })

  it('returns 500 when the row query fails', async () => {
    rowsResult = { data: null, error: { message: 'boom' } }
    const res = await GET(req('?providers=todoist') as any)
    expect(res.status).toBe(500)
  })
})
