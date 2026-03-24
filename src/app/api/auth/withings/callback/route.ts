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

    // Smart refresh token retention — keep existing if Withings omits it (matches Gmail pattern)
    let refreshTokenToStore: string | undefined = tokenData.refresh_token ?? undefined
    if (!refreshTokenToStore) {
      const { data: existingRow } = await serviceClient
        .from('user_integrations')
        .select('refresh_token')
        .eq('user_id', effectiveUserId)
        .eq('provider', 'withings')
        .maybeSingle()

      if (existingRow?.refresh_token) {
        refreshTokenToStore = existingRow.refresh_token as string
      }
    }

    const tokenDataToStore = { ...tokenData, refresh_token: refreshTokenToStore }
    const now = new Date().toISOString()

    // Check for existing row, then update or insert (avoids constraint name mismatches)
    const { data: existing } = await serviceClient
      .from('user_integrations')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('provider', 'withings')
      .maybeSingle()

    let storeError: any = null
    if (existing) {
      const { error } = await serviceClient
        .from('user_integrations')
        .update({
          access_token: tokenData.access_token,
          refresh_token: refreshTokenToStore,
          token_data: tokenDataToStore,
          updated_at: now,
        })
        .eq('id', existing.id)
      storeError = error
    } else {
      const { error } = await serviceClient
        .from('user_integrations')
        .insert({
          user_id: effectiveUserId,
          provider: 'withings',
          access_token: tokenData.access_token,
          refresh_token: refreshTokenToStore,
          token_data: tokenDataToStore,
          created_at: now,
          updated_at: now,
        })
      storeError = error
    }

    if (storeError) {
      console.error('Failed to store Withings tokens', storeError)
      redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + 'integrationError=true'
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}${redirectUrl}`)
  } catch (err) {
    console.error('Withings OAuth callback error', err)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || origin || 'http://localhost:3000'
    return NextResponse.redirect(`${baseUrl}/error?message=Withings authentication failed`)
  }
}
