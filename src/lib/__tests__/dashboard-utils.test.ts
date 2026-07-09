import type { User } from '@supabase/supabase-js'
import { deriveGreetingName } from '../dashboard-utils'

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'claude-ux-review@lifeboard.test',
    user_metadata: {},
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }) as User

describe('deriveGreetingName', () => {
  it('prefers the profile first name', () => {
    expect(deriveGreetingName({ first_name: 'Dalit' }, makeUser())).toBe('Dalit')
  })

  it('falls back to the first word of metadata names', () => {
    const user = makeUser({ user_metadata: { full_name: 'Dalit Barrett' } })
    expect(deriveGreetingName(null, user)).toBe('Dalit')
  })

  // Regression: the email localpart used to leak into the greeting
  // ("Welcome back, claude-ux-review"). Unknown names must yield "".
  it('returns empty string instead of the email localpart', () => {
    expect(deriveGreetingName(null, makeUser())).toBe('')
  })

  it('returns empty string when signed out', () => {
    expect(deriveGreetingName(null, null)).toBe('')
  })
})
