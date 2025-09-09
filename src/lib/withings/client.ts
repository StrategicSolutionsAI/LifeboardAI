import { URLSearchParams } from 'url'

const WITHINGS_AUTH_BASE = 'https://account.withings.com/oauth2_user/authorize2'
const WITHINGS_TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2'

// Withings scopes – for weight and body composition data we need "user.metrics"
export const WITHINGS_SCOPES = ['user.metrics']

function getRedirectUri(origin?: string) {
  const base = origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `${base}/api/auth/withings/callback`
}

export function getWithingsAuthUrl(origin?: string) {
  const params = new URLSearchParams({
    client_id: process.env.WITHINGS_CLIENT_ID || '',
    response_type: 'code',
    scope: WITHINGS_SCOPES.join(','), // Withings expects scopes comma-separated
    redirect_uri: getRedirectUri(origin),
    state: 'dummy', // actual state will be appended by caller
  })

  return `${WITHINGS_AUTH_BASE}?${params.toString()}`
}

// The token endpoint requires the "action" parameter
export async function exchangeWithingsCodeForToken(code: string, origin?: string) {
  const params = new URLSearchParams({
    action: 'requesttoken', // official docs: action=requesttoken was replaced by gettoken; both accepted
    grant_type: 'authorization_code',
    client_id: process.env.WITHINGS_CLIENT_ID || '',
    client_secret: process.env.WITHINGS_CLIENT_SECRET || '',
    code,
    redirect_uri: getRedirectUri(origin),
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
    // Handle specific Withings error codes
    if (data.status === 2554) {
      throw new Error('REFRESH_TOKEN_EXPIRED')
    } else if (data.status === 401) {
      throw new Error('INVALID_REFRESH_TOKEN')
    } else {
      throw new Error(`Withings token refresh error status: ${data.status} - ${data.error || 'Unknown error'}`)
    }
  }
  return data.body
}

// Fetch latest (most recent) weight measurement in kilograms
export async function fetchWithingsLatestWeight(accessToken: string) {
  const nowSec = Math.floor(Date.now() / 1000)
  // Add 24 hours to end date to ensure we capture today's measurements regardless of timezone
  const endDateSec = nowSec + (24 * 60 * 60)
  // Fetch last 7 days to ensure at least one measurement
  const params = new URLSearchParams({
    action: 'getmeas',
    meastype: '1', // weight
    category: '1',
    startdate: (nowSec - 7 * 24 * 60 * 60).toString(),
    enddate: endDateSec.toString(),
  })

  const response = await fetch(`https://wbsapi.withings.net/measure?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Withings API HTTP error: ${response.status}`)
  }

  const data = await response.json()
  
  // Debug logging to see what measurements we're getting
  console.log('Withings API response:', JSON.stringify(data, null, 2))
  
  // Handle Withings API error responses
  if (data.status !== 0) {
    if (data.status === 401) {
      throw new Error('INVALID_TOKEN')
    } else if (data.status === 601) {
      throw new Error('RATE_LIMITED')
    } else {
      throw new Error(`Withings API error: ${data.status} - ${data.error || 'Unknown error'}`)
    }
  }
  
  if (!data.body?.measuregrps) {
    throw new Error('No weight measurements found')
  }

  const groups = data.body.measuregrps
  console.log(`Found ${groups.length} measurement groups`)
  
  // Log each measurement group with its date
  groups.forEach((group: any, index: number) => {
    const date = new Date(group.date * 1000)
    console.log(`Group ${index}: Date ${date.toISOString()}, Measures:`, group.measures)
  })

  // Sort groups by date to ensure we get the most recent (groups may not be pre-sorted)
  const sortedGroups = groups.sort((a: any, b: any) => a.date - b.date)
  
  // Take the last group (most recent)
  const latestGroup = sortedGroups[sortedGroups.length - 1]
  const latestDate = new Date(latestGroup.date * 1000)
  console.log(`Using latest group from: ${latestDate.toISOString()}`)
  
  // Find the weight measurement (type 1) in the latest group
  const weightMeasure = latestGroup.measures.find((m: any) => m.type === 1)
  if (!weightMeasure) {
    throw new Error('No weight measurement in latest group')
  }

  // Convert from Withings format (value * 10^unit) to kg
  const weightKg = weightMeasure.value * Math.pow(10, weightMeasure.unit)
  console.log(`Calculated weight: ${weightKg} kg`)
  
  return weightKg
} 
