// Import the Calendar API module directly instead of the `googleapis` root
// barrel: the barrel eagerly instantiates every Google API (985 modules,
// ~1.3s of module eval per cold start) versus 123 modules / ~50ms here.
import { calendar, auth } from 'googleapis/build/src/apis/calendar';

// Google Calendar API scopes
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

function resolveOrigin(origin?: string) {
  return origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

export function getGoogleAuthUrl(origin?: string) {
  const base = resolveOrigin(origin)
  const oauth2Client = new auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${base}/api/auth/google/callback`
  )

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })

  return url
}

export function getOAuth2Client(origin?: string) {
  const base = resolveOrigin(origin)
  return new auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${base}/api/auth/google/callback`
  )
}

/**
 * Create a Google Calendar API client with tokens
 */
export async function getCalendarClient(tokens: any) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);
  
  return calendar({
    version: 'v3',
    auth: oauth2Client
  });
}
