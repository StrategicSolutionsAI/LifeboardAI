import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import {
  fetchFitbitDailySummary,
  refreshFitbitToken,
  fetchFitbitWater,
} from '@/lib/fitbit/client'

export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get('date')
  // Fitbit expects yyyy-MM-dd. Default to today in that format (local time).
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = `${today.getMonth() + 1}`.padStart(2, '0')
  const dd = `${today.getDate()}`.padStart(2, '0')
  const dateStr = dateParam ?? `${yyyy}-${mm}-${dd}`

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 },
    )
  }

  // Get integration row
  const { data: integration, error: integrationError } = await supabase
    .from('user_integrations')
    .select('id, access_token, refresh_token, token_data, updated_at')
    .eq('user_id', user.id)
    .eq('provider', 'fitbit')
    .maybeSingle()

  if (integrationError || !integration?.access_token) {
    return NextResponse.json(
      { error: 'Fitbit not connected' },
      { status: 400 },
    )
  }

  let accessToken = integration.access_token
  const refreshToken = integration.refresh_token ?? ''

  // Optional: naive expiry check if token_data.expires_in + updated_at < now
  try {
    const tokenData = (integration.token_data || {}) as { expires_in?: number }
    if (tokenData.expires_in && integration.updated_at) {
      const updated = new Date(integration.updated_at).getTime()
      const expiresAt = updated + tokenData.expires_in * 1000
      if (Date.now() > expiresAt - 60 * 1000) {
        // refresh token
        const newTokens = await refreshFitbitToken(refreshToken)
        accessToken = newTokens.access_token
        // Save updated tokens
        await supabase
          .from('user_integrations')
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token ?? refreshToken,
            token_data: newTokens,
            updated_at: new Date().toISOString(),
          })
          .eq('id', integration.id)
      }
    }
  } catch (e) {
    console.error('Error refreshing Fitbit token', e)
  }

  try {
    // Always attempt to fetch steps & calories
    const summary = await fetchFitbitDailySummary(accessToken, dateStr)
    const steps = summary.summary?.steps ?? 0
    const calories = summary.summary?.caloriesOut ?? 0

    // Fetch water separately – if Fitbit rate-limits (429) or user has no nutrition scope,
    // don't fail the whole request. Default to 0 cups and surface a warning instead.
    let waterCups = 0
    try {
      const waterJson = await fetchFitbitWater(accessToken, dateStr)
      const waterMl = waterJson.summary?.water ?? 0
      waterCups = +(waterMl / 236.588).toFixed(1)
    } catch (err) {
      console.warn('Fitbit water fetch failed (non-fatal)', err instanceof Error ? err.message : err)
    }

    return NextResponse.json({ steps, calories, water: waterCups }, { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' } })
  } catch (e) {
    console.error('Failed to fetch Fitbit summary', e)
    const errMessage = e instanceof Error ? e.message : String(e)
    const isRateLimited = /429/.test(errMessage)
    return NextResponse.json({ error: errMessage }, { status: isRateLimited ? 429 : 500 })
  }
} 