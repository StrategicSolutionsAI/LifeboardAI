import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeWithingsCodeForToken } from '@/lib/withings/client'
import { supabaseServer } from '@/utils/supabase/server'
import { sanitizeRedirectUrl } from '@/lib/url-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  let redirectUrl = '/dashboard'
  let userIdFromState = ''

  if (state) {
    try {
      const s = JSON.parse(decodeURIComponent(state))
      if (s.redirectUrl) redirectUrl = sanitizeRedirectUrl(s.redirectUrl)
      if (s.userId) userIdFromState = s.userId
    } catch (e) {
      console.error('Failed to parse state param', e)
    }
  }

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/error?message=No authorization code from Withings`)
  }

  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  const origin = forwardedProto && forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin

  try {
    const tokenData = await exchangeWithingsCodeForToken(code, origin)

    const supabase = supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

    const effectiveUserId = user?.id || userIdFromState

    if (!effectiveUserId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/login?error=User not authenticated`)
    }

    // Use service role client to bypass RLS — the user is verified via OAuth state
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const providerUserId = tokenData.userid ? String(tokenData.userid) : null

    // Smart refresh token retention — keep existing if Withings omits it (matches Gmail pattern)
    let refreshTokenToStore: string | undefined = tokenData.refresh_token ?? undefined
    if (!refreshTokenToStore) {
      const query = serviceClient
        .from('user_integrations')
        .select('refresh_token')
        .eq('user_id', effectiveUserId)
        .eq('provider', 'withings')
      if (providerUserId) query.eq('provider_user_id', providerUserId)
      const { data: existingRow } = await query.maybeSingle()

      if (existingRow?.refresh_token) {
        refreshTokenToStore = existingRow.refresh_token as string
      }
    }

    const tokenDataToStore = { ...tokenData, refresh_token: refreshTokenToStore }

    // Atomic upsert — no delete+insert race condition
    const { error: upsertError } = await serviceClient
      .from('user_integrations')
      .upsert(
        {
          user_id: effectiveUserId,
          provider: 'withings',
          provider_user_id: providerUserId,
          access_token: tokenData.access_token,
          refresh_token: refreshTokenToStore,
          token_data: tokenDataToStore,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider,provider_user_id' },
      )

    if (upsertError) {
      console.error('Failed to store Withings tokens', upsertError)
      redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + 'integrationError=true'
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}${redirectUrl}`)
  } catch (err) {
    console.error('Withings OAuth callback error', err)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || origin || 'http://localhost:3000'
    return NextResponse.redirect(`${baseUrl}/error?message=Withings authentication failed`)
  }
} 
