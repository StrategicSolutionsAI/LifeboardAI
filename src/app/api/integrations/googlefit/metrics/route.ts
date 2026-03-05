import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import {
  refreshGoogleFitToken,
  fetchGoogleFitSteps,
  fetchGoogleFitStepsWithRetry,
} from '@/lib/googlefit/client'

export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get('date')
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
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: integration, error: integrationError } = await supabase
    .from('user_integrations')
    .select('id, access_token, refresh_token, token_data, updated_at')
    .eq('user_id', user.id)
    .eq('provider', 'google-fit')
    .maybeSingle()

  if (integrationError || !integration?.access_token) {
    return NextResponse.json(
      { error: 'Google Fit not connected' },
      { status: 400 },
    )
  }

  let accessToken = integration.access_token
  const refreshToken = integration.refresh_token ?? ''

  try {
    const tokenData = (integration.token_data || {}) as { expires_in?: number }
    if (tokenData.expires_in && integration.updated_at) {
      const updated = new Date(integration.updated_at).getTime()
      const expiresAt = updated + tokenData.expires_in * 1000
      if (Date.now() > expiresAt - 60 * 1000) {
        const newTokens = await refreshGoogleFitToken(refreshToken)
        accessToken = newTokens.access_token
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
    console.error('Error refreshing Google Fit token', e)
  }

  try {
    // Use the improved retry mechanism for better data accuracy
    const steps = await fetchGoogleFitStepsWithRetry(accessToken, dateStr)
    return NextResponse.json({ steps }, { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' } })
  } catch (e) {
    console.error('Google Fit steps fetch failed', e)
    const errMessage = e instanceof Error ? e.message : String(e)
    const isRateLimited = /429/.test(errMessage)
    return NextResponse.json(
      { error: errMessage },
      { status: isRateLimited ? 429 : 500 },
    )
  }
}
