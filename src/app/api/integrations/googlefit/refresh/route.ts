import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import {
  refreshGoogleFitToken,
  triggerGoogleFitSync,
  checkGoogleFitDataSources,
  fetchGoogleFitStepsWithRetry,
} from '@/lib/googlefit/client'

export async function POST(request: NextRequest) {
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
    // Refresh token if needed
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

    // Try to trigger sync
    const syncTriggered = await triggerGoogleFitSync(accessToken)
    
    // Check data sources
    const dataSources = await checkGoogleFitDataSources(accessToken)
    
    // Get current steps with retry
    const today = new Date().toISOString().split('T')[0]
    const steps = await fetchGoogleFitStepsWithRetry(accessToken, today)

    return NextResponse.json({
      success: true,
      syncTriggered,
      steps,
      dataSources: dataSources.length,
      message: syncTriggered 
        ? 'Data refresh attempted successfully' 
        : 'Refresh attempted but sync trigger failed'
    })
  } catch (e) {
    console.error('Google Fit refresh failed', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}