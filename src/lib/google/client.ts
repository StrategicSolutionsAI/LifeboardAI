import { google } from 'googleapis';

// Google Calendar API scopes
export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

function resolveOrigin(origin?: string) {
  return origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

export function getGoogleAuthUrl(origin?: string) {
  const base = resolveOrigin(origin)
  const oauth2Client = new google.auth.OAuth2(
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
  return new google.auth.OAuth2(
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
  
  return google.calendar({
    version: 'v3',
    auth: oauth2Client
  });
}
