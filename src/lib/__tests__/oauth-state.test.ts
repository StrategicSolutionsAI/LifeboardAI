import { createOAuthState, verifyOAuthState } from '@/lib/oauth-state'

describe('OAuth state', () => {
  it('round-trips signed state for the intended user', () => {
    const state = createOAuthState({ redirectUrl: '/integrations', userId: 'user-1' })
    expect(verifyOAuthState(state)).toEqual(expect.objectContaining({
      redirectUrl: '/integrations',
      userId: 'user-1',
    }))
  })

  it('rejects tampering and missing state', () => {
    const state = createOAuthState({ redirectUrl: '/integrations', userId: 'user-1' })
    const [payload, signature] = state.split('.')
    const tampered = `${payload}.${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`

    expect(verifyOAuthState(tampered)).toBeNull()
    expect(verifyOAuthState(null)).toBeNull()
  })
})
