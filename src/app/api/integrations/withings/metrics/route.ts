import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { fetchWithingsLatestWeight, refreshWithingsToken } from '@/lib/withings/client'

export async function GET(request: NextRequest) {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let effectiveUser = user

  if (!effectiveUser) {
    // Sometimes getUser() returns null because cookies are split; fallback to getSession()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user) {
      effectiveUser = session.user
    }
  }

  if (!effectiveUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Fetch integration row
  const { data: integration, error: integrationError } = await supabase
    .from('user_integrations')
    .select('id, access_token, refresh_token, token_data, updated_at')
    .eq('user_id', effectiveUser.id)
    .eq('provider', 'withings')
    .maybeSingle()

  if (integrationError || !integration?.access_token) {
    return NextResponse.json({ error: 'Withings not connected' }, { status: 400 })
  }

  let accessToken = integration.access_token
  const refreshToken = integration.refresh_token ?? ''

  // Check expiry similar to fitbit
  try {
    const tokenData: any = integration.token_data || {}
    if (tokenData.expires_in && integration.updated_at) {
      const updated = new Date(integration.updated_at).getTime()
      const expiresAt = updated + tokenData.expires_in * 1000
      if (Date.now() > expiresAt - 60 * 1000) {
        const newTokens = await refreshWithingsToken(refreshToken)
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
    console.error('Error refreshing Withings token', e)
  }

  try {
    const weightKg = await fetchWithingsLatestWeight(accessToken)
    return NextResponse.json({ weightKg })
  } catch (e: any) {
    console.error('Failed to fetch Withings metrics', e)
    const isRateLimited = /429/.test(e.message ?? '')
    return NextResponse.json({ error: e.message }, { status: isRateLimited ? 429 : 500 })
  }
} 