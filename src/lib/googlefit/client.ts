import { URLSearchParams } from 'url'

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export const GOOGLE_FIT_SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  // add more scopes if you need additional metrics
]

function getRedirectUri() {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/auth/googlefit/callback`
}

export function getGoogleFitAuthUrl() {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_FIT_CLIENT_ID || '',
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: GOOGLE_FIT_SCOPES.join(' '),
    access_type: 'offline', // ensures refresh token
    prompt: 'consent',
  })

  return `${GOOGLE_AUTH_BASE}?${params.toString()}`
}

export async function exchangeGoogleFitCodeForToken(code: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_FIT_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET || '',
    redirect_uri: getRedirectUri(),
    grant_type: 'authorization_code',
    code,
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google token exchange failed: ${response.status} ${text}`)
  }

  return response.json()
}

export async function refreshGoogleFitToken(refreshToken: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_FIT_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET || '',
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google token refresh failed: ${response.status} ${text}`)
  }

  return response.json()
}

export async function fetchGoogleFitSteps(accessToken: string, date: string) {
  // date format yyyy-MM-dd
  const [yyyy, mm, dd] = date.split('-').map(Number)
  // Use the user's local timezone to match what the Google Fit mobile app shows.
  const startMs = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0).getTime()
  const endMs = new Date(yyyy, mm - 1, dd, 23, 59, 59, 999).getTime()

  const body = {
    aggregateBy: [
      {
        dataTypeName: 'com.google.step_count.delta',

      },
    ],
    bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
    startTimeMillis: startMs,
    endTimeMillis: endMs,
  }

  const response = await fetch(
    'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Fit steps fetch failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  let steps = 0
  if (data.bucket?.length) {
    for (const bucket of data.bucket) {
      for (const dataset of bucket.dataset ?? []) {
        for (const point of dataset.point ?? []) {
          for (const v of point.value ?? []) {
            steps += v.intVal ?? 0
          }
        }
      }
    }
  }
  return steps
}
