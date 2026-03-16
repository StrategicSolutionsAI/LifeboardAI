import { google } from 'googleapis'

// Gmail API scopes — request all upfront so users only authorize once
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
]

function resolveOrigin(origin?: string) {
  return origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

export function getGmailAuthUrl(origin?: string) {
  const base = resolveOrigin(origin)
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${base}/api/auth/gmail/callback`
  )

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    prompt: 'consent',
  })

  return url
}

export function getGmailOAuth2Client(origin?: string) {
  const base = resolveOrigin(origin)
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${base}/api/auth/gmail/callback`
  )
}

/**
 * Create a Gmail API client with tokens.
 *
 * If the access token is expired the googleapis library will use the
 * refresh_token automatically. We attach a listener so the new tokens
 * are written back to Supabase.
 */
export async function getGmailClient(
  tokens: any,
  opts?: { userId?: string; supabase?: any },
) {
  const oauth2Client = getGmailOAuth2Client()
  oauth2Client.setCredentials(tokens)

  // Persist refreshed tokens so the next request uses the fresh access_token
  if (opts?.userId && opts?.supabase) {
    oauth2Client.on('tokens', async (newTokens) => {
      try {
        const merged = { ...tokens, ...newTokens }
        await opts.supabase
          .from('user_integrations')
          .update({
            access_token: merged.access_token,
            token_data: merged,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', opts.userId)
          .eq('provider', 'gmail')
      } catch (e) {
        console.error('Failed to persist refreshed Gmail tokens:', e)
      }
    })
  }

  return google.gmail({
    version: 'v1',
    auth: oauth2Client,
  })
}

/**
 * Convenience: look up a user's Gmail tokens from Supabase and return a
 * ready-to-use Gmail API client. Returns `null` if no integration found.
 */
export async function getGmailForUser(
  supabase: any,
  userId: string,
  account?: string,
) {
  const query = supabase
    .from('user_integrations')
    .select('token_data')
    .eq('user_id', userId)
    .eq('provider', 'gmail')
  if (account) query.eq('provider_user_id', account)
  const { data: integration } = await query.maybeSingle()
  if (!integration?.token_data) return null
  return getGmailClient(integration.token_data, { userId, supabase })
}
