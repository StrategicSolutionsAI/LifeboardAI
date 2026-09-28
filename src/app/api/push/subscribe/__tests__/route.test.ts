/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '../route'

const rpc = jest.fn()
const supabaseMock = {
  auth: { getUser: jest.fn(), getSession: jest.fn(async () => ({ data: { session: null } })) },
  rpc: (...a: unknown[]) => rpc(...a),
}
jest.mock('@/utils/supabase/server', () => ({ supabaseServer: jest.fn(() => supabaseMock) }))

const body = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: 'BPk', auth: 'xyz' },
  timeZone: 'America/Chicago',
}
const post = (b: unknown) => POST(new NextRequest('http://localhost:3000/api/push/subscribe', { method: 'POST', body: JSON.stringify(b) }))

describe('POST /api/push/subscribe', () => {
  beforeEach(() => jest.clearAllMocks())

  it('401 when signed out', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await post(body)).status).toBe(401)
  })

  it('400 without keys', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    expect((await post({ endpoint: body.endpoint, timeZone: 'UTC' })).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('claims the endpoint for the caller with their time zone', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    rpc.mockResolvedValue({ error: null })
    expect((await post(body)).status).toBe(201)
    expect(rpc).toHaveBeenCalledWith('claim_push_subscription', {
      p_endpoint: body.endpoint, p_p256dh: 'BPk', p_auth: 'xyz', p_time_zone: 'America/Chicago',
    })
  })
})
