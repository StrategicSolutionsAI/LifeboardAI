import { URLSearchParams } from 'url'

const WITHINGS_AUTH_BASE = 'https://account.withings.com/oauth2_user/authorize2'
const WITHINGS_TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2'

// Withings scopes – for weight and body composition data we need "user.metrics"
export const WITHINGS_SCOPES = ['user.metrics']

function getRedirectUri() {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/auth/withings/callback`
}

export function getWithingsAuthUrl() {
  const params = new URLSearchParams({
    client_id: process.env.WITHINGS_CLIENT_ID || '',
    response_type: 'code',
    scope: WITHINGS_SCOPES.join(','), // Withings expects scopes comma-separated
    redirect_uri: getRedirectUri(),
    state: 'dummy', // actual state will be appended by caller
  })

  return `${WITHINGS_AUTH_BASE}?${params.toString()}`
}

// The token endpoint requires the "action" parameter
export async function exchangeWithingsCodeForToken(code: string) {
  const params = new URLSearchParams({
    action: 'requesttoken', // official docs: action=requesttoken was replaced by gettoken; both accepted
    grant_type: 'authorization_code',
    client_id: process.env.WITHINGS_CLIENT_ID || '',
    client_secret: process.env.WITHINGS_CLIENT_SECRET || '',
    code,
    redirect_uri: getRedirectUri(),
  })

  const response = await fetch(WITHINGS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Withings token exchange failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  if (data.status !== 0) {
    throw new Error(`Withings token exchange error status: ${data.status}`)
  }
  // data.body contains access_token, refresh_token, expires_in, token_type, scope, userid
  return data.body
}

export async function refreshWithingsToken(refreshToken: string) {
  const params = new URLSearchParams({
    action: 'refresh_token',
    grant_type: 'refresh_token',
    client_id: process.env.WITHINGS_CLIENT_ID || '',
    client_secret: process.env.WITHINGS_CLIENT_SECRET || '',
    refresh_token: refreshToken,
  })

  const response = await fetch(WITHINGS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Withings token refresh failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  if (data.status !== 0) {
    throw new Error(`Withings token refresh error status: ${data.status}`)
  }
  return data.body
}

// Fetch latest (most recent) weight measurement in kilograms
export async function fetchWithingsLatestWeight(accessToken: string) {
  const nowSec = Math.floor(Date.now() / 1000)
  // Fetch last 7 days to ensure at least one measurement
  const params = new URLSearchParams({
    action: 'getmeas',
    meastype: '1', // weight
    category: '1',
    startdate: (nowSec - 7 * 24 * 60 * 60).toString(),
    enddate: nowSec.toString(),
  })

  const response = await fetch(`https://wbsapi.withings.net/measure?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Withings weight fetch failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  if (data.status !== 0) {
    throw new Error(`Withings API returned error status ${data.status}`)
  }

  // data.body.measuregrps is an array, sorted ascending by date.
  const groups = data.body?.measuregrps ?? []
  if (!groups.length) return null

  const latest = groups[groups.length - 1]
  // Each group has measures array with value and unit (10^unit)
  const weightMeasure = latest.measures?.find((m: any) => m.type === 1)
  if (!weightMeasure) return null
  const weightKg = weightMeasure.value * Math.pow(10, weightMeasure.unit)
  return weightKg
} 