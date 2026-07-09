import { getUserCached } from '@/lib/server-auth-cache'
import type { User } from '@supabase/supabase-js'

const b64url = (obj: object) =>
  Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// Each test crafts a unique token (module-level cache persists across tests)
function makeToken(expSecondsFromNow: number, salt: string): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow, salt })
  return `${header}.${payload}.signature`
}

function makeClient(user: User | null, token: string | null) {
  return {
    auth: {
      getUser: jest.fn(async () =>
        user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { name: 'AuthApiError', message: 'invalid' } as any }
      ),
      getSession: jest.fn(async () => ({
        data: { session: token ? { access_token: token } : null },
      })),
    },
  }
}

const user = { id: 'user-1', email: 'u@example.com' } as User

describe('getUserCached', () => {
  it('validates via getUser on first call, serves from cache within TTL', async () => {
    const token = makeToken(3600, 'cache-hit')
    const client = makeClient(user, token)

    const first = await getUserCached(client)
    expect(first.data.user?.id).toBe('user-1')
    expect(client.auth.getUser).toHaveBeenCalledTimes(1)

    const second = await getUserCached(client)
    expect(second.data.user?.id).toBe('user-1')
    expect(second.error).toBeNull()
    expect(client.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('shares the cache across client instances for the same token', async () => {
    const token = makeToken(3600, 'cross-client')
    const clientA = makeClient(user, token)
    const clientB = makeClient(user, token)

    await getUserCached(clientA)
    await getUserCached(clientB)

    expect(clientA.auth.getUser).toHaveBeenCalledTimes(1)
    expect(clientB.auth.getUser).not.toHaveBeenCalled()
  })

  it('uses the explicit bearer token without reading the session', async () => {
    const token = makeToken(3600, 'bearer')
    const client = makeClient(user, null)

    await getUserCached(client, token)

    expect(client.auth.getSession).not.toHaveBeenCalled()
    expect(client.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('bypasses the cache when the token is near expiry so refresh still runs', async () => {
    const token = makeToken(30, 'near-expiry') // inside the 60s buffer
    const client = makeClient(user, token)

    await getUserCached(client)
    await getUserCached(client)

    expect(client.auth.getUser).toHaveBeenCalledTimes(2)
  })

  it('does not cache failed validations', async () => {
    const token = makeToken(3600, 'invalid-token')
    const client = makeClient(null, token)

    const first = await getUserCached(client)
    expect(first.data.user).toBeNull()

    await getUserCached(client)
    expect(client.auth.getUser).toHaveBeenCalledTimes(2)
  })

  it('falls through to getUser when there is no session at all', async () => {
    const client = makeClient(null, null)

    const result = await getUserCached(client)

    expect(result.data.user).toBeNull()
    expect(client.auth.getUser).toHaveBeenCalledTimes(1)
  })
})
