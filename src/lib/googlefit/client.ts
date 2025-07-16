import { URLSearchParams } from 'url'

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export const GOOGLE_FIT_SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.body.read',
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

  // Try to fetch from multiple data sources for better accuracy
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

// New function to try fetching current real-time data
export async function fetchGoogleFitStepsWithRetry(accessToken: string, date: string, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const steps = await fetchGoogleFitSteps(accessToken, date)
      
      // If we get zero steps and it's today, try fetching with a wider time range
      if (steps === 0 && date === new Date().toISOString().split('T')[0]) {
        // Try fetching from yesterday to now to capture any delayed sync
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
        
        const extendedSteps = await fetchGoogleFitStepsExtended(accessToken, yesterdayStr, date)
        if (extendedSteps > steps) {
          return extendedSteps
        }
      }
      
      return steps
    } catch (error) {
      if (i === retries) throw error
      // Wait briefly before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  return 0
}

// Helper function to fetch steps across a date range
export async function fetchGoogleFitStepsExtended(accessToken: string, startDate: string, endDate: string) {
  const [startYyyy, startMm, startDd] = startDate.split('-').map(Number)
  const [endYyyy, endMm, endDd] = endDate.split('-').map(Number)
  
  const startMs = new Date(startYyyy, startMm - 1, startDd, 0, 0, 0, 0).getTime()
  const endMs = new Date(endYyyy, endMm - 1, endDd, 23, 59, 59, 999).getTime()

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
    throw new Error(`Google Fit extended steps fetch failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  
  // Find today's bucket specifically
  const todayStr = endDate
  let todaySteps = 0
  
  if (data.bucket?.length) {
    for (const bucket of data.bucket) {
      const bucketStart = new Date(parseInt(bucket.startTimeMillis))
      const bucketDateStr = bucketStart.toISOString().split('T')[0]
      
      if (bucketDateStr === todayStr) {
        for (const dataset of bucket.dataset ?? []) {
          for (const point of dataset.point ?? []) {
            for (const v of point.value ?? []) {
              todaySteps += v.intVal ?? 0
            }
          }
        }
      }
    }
  }
  
  return todaySteps
}

// Function to check available data sources for debugging
export async function checkGoogleFitDataSources(accessToken: string) {
  try {
    const response = await fetch(
      'https://www.googleapis.com/fitness/v1/users/me/dataSources',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    
    if (!response.ok) {
      throw new Error(`Data sources check failed: ${response.status}`)
    }
    
    const data = await response.json()
    return data.dataSource || []
  } catch (error) {
    console.error('Failed to check data sources:', error)
    return []
  }
}

// Function to trigger data sync (limited effectiveness but worth trying)
export async function triggerGoogleFitSync(accessToken: string) {
  try {
    // This doesn't actually trigger a sync, but requesting recent data
    // sometimes helps Google Fit realize it needs to sync
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    
    const startMs = oneHourAgo.getTime()
    const endMs = now.getTime()
    
    const body = {
      aggregateBy: [
        {
          dataTypeName: 'com.google.step_count.delta',
        },
      ],
      bucketByTime: { durationMillis: 60 * 60 * 1000 }, // 1 hour buckets
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
    
    return response.ok
  } catch (error) {
    console.error('Sync trigger failed:', error)
    return false
  }
}
