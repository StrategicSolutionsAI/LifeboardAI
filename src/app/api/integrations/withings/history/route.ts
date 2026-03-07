import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { fetchWithingsWeightHistory, refreshWithingsToken } from '@/lib/withings/client'
import { withRefreshLock } from '@/lib/token-refresh-lock'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface MeasurementRow {
  id: string
  user_id: string
  weight_kg: number
  weight_lbs: number
  measured_at: string
  source?: string | null
  created_at?: string | null
}

/**
 * Fetch weight history from the Withings API directly.
 * Used as a fallback when the weight_measurements table doesn't exist.
 */
async function fetchFromWithingsApi(
  supabase: ReturnType<typeof supabaseServer>,
  userId: string,
  startDate: Date
) {
  // Get Withings integration tokens
  const { data: integrations, error: integrationError } = await supabase
    .from('user_integrations')
    .select('id, access_token, refresh_token, token_data, updated_at')
    .eq('user_id', userId)
    .eq('provider', 'withings')
    .order('updated_at', { ascending: false })
    .limit(1)

  if (integrationError || !integrations?.[0]?.access_token) {
    return { measurements: [], error: null }
  }

  const integration = integrations[0]
  let accessToken = integration.access_token

  // Helper to refresh the token using the shared lock (prevents race conditions
  // when metrics + history routes both try to refresh simultaneously).
  async function refreshTokenSafe(): Promise<string | null> {
    if (!integration.refresh_token) return null
    try {
      const result = await withRefreshLock(integration.id, async () => {
        // Re-read the latest refresh token from DB inside the lock
        const { data: freshRow } = await supabase
          .from('user_integrations')
          .select('access_token, refresh_token, token_data, updated_at')
          .eq('id', integration.id)
          .maybeSingle()

        // Check if another request already refreshed
        if (freshRow?.updated_at) {
          const tokenData = (freshRow.token_data || {}) as { expires_in?: number }
          const updatedMs = new Date(freshRow.updated_at).getTime()
          const expiresIn = (tokenData.expires_in ?? 3600) * 1000
          if (Date.now() < updatedMs + expiresIn - 60_000 && freshRow.access_token) {
            return freshRow.access_token
          }
        }

        const latestRefresh = freshRow?.refresh_token || integration.refresh_token
        const refreshResult = await refreshWithingsToken(latestRefresh!)
        await supabase
          .from('user_integrations')
          .update({
            access_token: refreshResult.access_token,
            refresh_token: refreshResult.refresh_token,
            token_data: refreshResult,
            updated_at: new Date().toISOString(),
          })
          .eq('id', integration.id)
        return refreshResult.access_token as string
      })
      return result
    } catch {
      return null
    }
  }

  // Check if token needs refresh
  const tokenData = (integration.token_data || {}) as { expires_in?: number }
  if (tokenData.expires_in && integration.updated_at) {
    const updated = new Date(integration.updated_at).getTime()
    const expiresAt = updated + tokenData.expires_in * 1000
    if (Date.now() > expiresAt - 60 * 1000) {
      const refreshed = await refreshTokenSafe()
      if (refreshed) accessToken = refreshed
    }
  }

  try {
    const measurements = await fetchWithingsWeightHistory(accessToken, startDate)
    return { measurements, error: null }
  } catch (err) {
    // If token is invalid, try refresh once via the lock
    if (err instanceof Error && err.message === 'INVALID_TOKEN') {
      const refreshed = await refreshTokenSafe()
      if (refreshed) {
        try {
          const measurements = await fetchWithingsWeightHistory(refreshed, startDate)
          return { measurements, error: null }
        } catch (retryErr) {
          return { measurements: [], error: retryErr }
        }
      }
    }
    return { measurements: [], error: err }
  }
}

export async function GET(request: NextRequest) {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(request.url)
  const days = parseInt(url.searchParams.get('days') || '30')
  const limit = parseInt(url.searchParams.get('limit') || '100')

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  try {
    // Try the database table first
    const { data: measurements, error } = await supabase
      .from('weight_measurements')
      .select('*')
      .eq('user_id', user.id)
      .gte('measured_at', startDate.toISOString())
      .order('measured_at', { ascending: false })
      .limit(limit)

    // If the table doesn't exist or query failed, fall back to Withings API
    if (error) {
      console.error('Error fetching weight history from DB, falling back to Withings API:', error.message)

      const { measurements: apiMeasurements, error: apiError } = await fetchFromWithingsApi(
        supabase,
        user.id,
        startDate
      )

      if (apiError) {
        console.error('Withings API fallback also failed:', apiError)
      }

      const weights = apiMeasurements.map((m) => m.weightKg)
      const stats = {
        count: apiMeasurements.length,
        latest: weights[0] || null,
        earliest: weights[weights.length - 1] || null,
        min: weights.length > 0 ? Math.min(...weights) : null,
        max: weights.length > 0 ? Math.max(...weights) : null,
        average: weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : null,
        change: weights.length > 1 ? weights[0] - weights[weights.length - 1] : null,
      }

      const res = NextResponse.json({
        measurements: apiMeasurements,
        stats,
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
        source: 'withings_api',
      })
      res.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120')
      return res
    }

    const rows: MeasurementRow[] = (measurements || []) as unknown as MeasurementRow[]

    // If DB table exists but has no data, fall back to Withings API
    if (rows.length === 0) {
      const { measurements: apiMeasurements } = await fetchFromWithingsApi(
        supabase,
        user.id,
        startDate
      )

      if (apiMeasurements.length > 0) {
        const weights = apiMeasurements.map((m) => m.weightKg)
        const res = NextResponse.json({
          measurements: apiMeasurements,
          stats: {
            count: apiMeasurements.length,
            latest: weights[0] || null,
            earliest: weights[weights.length - 1] || null,
            min: Math.min(...weights),
            max: Math.max(...weights),
            average: weights.reduce((a, b) => a + b, 0) / weights.length,
            change: weights.length > 1 ? weights[0] - weights[weights.length - 1] : null,
          },
          period: {
            days,
            startDate: startDate.toISOString(),
            endDate: new Date().toISOString(),
          },
          source: 'withings_api',
        })
        res.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120')
        return res
      }
    }

    // Format DB data for the frontend
    const formattedData = rows.map((measurement) => ({
      id: measurement.id,
      weightKg: measurement.weight_kg,
      weightLbs: measurement.weight_lbs,
      measuredAt: measurement.measured_at,
      source: measurement.source ?? null,
      createdAt: measurement.created_at ?? null,
    }))

    const weights = rows.map((m) => m.weight_kg)
    const stats = {
      count: rows.length,
      latest: weights[0] || null,
      earliest: weights[weights.length - 1] || null,
      min: weights.length > 0 ? Math.min(...weights) : null,
      max: weights.length > 0 ? Math.max(...weights) : null,
      average: weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : null,
      change: weights.length > 1 ? weights[0] - weights[weights.length - 1] : null,
    }

    const res = NextResponse.json({
      measurements: formattedData,
      stats,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      source: 'database',
    })
    res.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120')
    return res
  } catch (error) {
    console.error('Error in weight history endpoint:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
