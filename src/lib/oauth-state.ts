import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const STATE_TTL_MS = 10 * 60 * 1000

export type OAuthState = {
  redirectUrl: string
  userId: string
  issuedAt: number
  nonce: string
}

function getStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (secret) return secret

  if (process.env.NODE_ENV === 'production') {
    throw new Error('OAUTH_STATE_SECRET must be configured in production')
  }

  return 'lifeboard-development-oauth-state'
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function sign(payload: string): string {
  return createHmac('sha256', getStateSecret()).update(payload).digest('base64url')
}

export function createOAuthState(input: Omit<OAuthState, 'issuedAt' | 'nonce'>): string {
  const payload = encode(JSON.stringify({
    ...input,
    issuedAt: Date.now(),
    nonce: randomBytes(16).toString('hex'),
  }))

  return `${payload}.${sign(payload)}`
}

export function verifyOAuthState(value: string | null): OAuthState | null {
  if (!value) return null

  const [payload, signature] = value.split('.')
  if (!payload || !signature) return null

  const expected = sign(payload)
  const actualBytes = Buffer.from(signature, 'base64url')
  const expectedBytes = Buffer.from(expected, 'base64url')
  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return null
  }

  try {
    const state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState
    if (
      typeof state.redirectUrl !== 'string' ||
      typeof state.userId !== 'string' ||
      typeof state.issuedAt !== 'number' ||
      typeof state.nonce !== 'string' ||
      !state.userId ||
      Date.now() - state.issuedAt > STATE_TTL_MS ||
      state.issuedAt - Date.now() > 30_000
    ) {
      return null
    }
    return state
  } catch {
    return null
  }
}
