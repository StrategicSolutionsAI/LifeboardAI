import { URLSearchParams } from 'url';

const FITBIT_AUTH_BASE = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';

export const FITBIT_SCOPES = [
  'activity',
  'heartrate',
  'sleep',
  'nutrition',
  'profile',
];

function getRedirectUri() {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/auth/fitbit/callback`;
}

export function getFitbitAuthUrl() {
  const params = new URLSearchParams({
    client_id: process.env.FITBIT_CLIENT_ID || '',
    response_type: 'code',
    scope: FITBIT_SCOPES.join(' '),
    redirect_uri: getRedirectUri(),
    prompt: 'consent',
  });

  return `${FITBIT_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeFitbitCodeForToken(code: string) {
  const credentials = Buffer.from(
    `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`,
  ).toString('base64');

  const params = new URLSearchParams({
    client_id: process.env.FITBIT_CLIENT_ID || '',
    grant_type: 'authorization_code',
    redirect_uri: getRedirectUri(),
    code,
  });

  const response = await fetch(FITBIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fitbit token exchange failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data; // Contains access_token, refresh_token, expires_in, etc.
} 