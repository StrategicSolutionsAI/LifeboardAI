import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getGmailOAuth2Client } from '@/lib/gmail/client'
import { supabaseServer } from '@/utils/supabase/server'
import { PostgrestError } from '@supabase/supabase-js'
import { sanitizeRedirectUrl } from '@/lib/url-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  let redirectUrl = '/email'
  let userId = ''

  if (state) {
    try {
      const stateObj = JSON.parse(decodeURIComponent(state))
      if (stateObj.redirectUrl) redirectUrl = sanitizeRedirectUrl(stateObj.redirectUrl)
      if (stateObj.userId) userId = stateObj.userId
    } catch (e) {
      console.error('Error parsing state:', e)
    }
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/error?message=No authorization code received`
    )
  }

  try {
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const forwardedHost = request.headers.get('x-forwarded-host')
    const origin = forwardedProto && forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : new URL(request.url).origin
    const oauth2Client = getGmailOAuth2Client(origin)
    const { tokens } = await oauth2Client.getToken(code)

    const supabase = supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user && userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/login?error=Session expired, please log in again`
      )
    } else if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/login?message=Please complete authentication`
      )
    }

    // Fetch the Gmail user's email address for multi-account support
    const oauth2ClientForProfile = getGmailOAuth2Client(origin)
    oauth2ClientForProfile.setCredentials(tokens)
    const gmailClient = google.gmail({ version: 'v1', auth: oauth2ClientForProfile })
    let providerUserId = ''
    try {
      const profile = await gmailClient.users.getProfile({ userId: 'me' })
      providerUserId = profile.data.emailAddress ?? ''
    } catch (e) {
      console.error('Failed to fetch Gmail profile:', e)
    }

    // Store tokens with provider: 'gmail' (separate from Calendar's 'google')
    let insertError = null
    try {
      let refreshTokenToStore: string | undefined = tokens.refresh_token ?? undefined

      // Smart refresh token retention — keep existing if Google omits it
      if (!refreshTokenToStore) {
        const query = supabase
          .from('user_integrations')
          .select('refresh_token')
          .eq('user_id', user.id)
          .eq('provider', 'gmail')
        if (providerUserId) query.eq('provider_user_id', providerUserId)
        const { data: existingRow } = await query.maybeSingle()

        if (existingRow?.refresh_token) {
          refreshTokenToStore = existingRow.refresh_token as string
        }
      }

      const tokenDataToStore = { ...tokens, refresh_token: refreshTokenToStore }

      const { error } = await supabase
        .from('user_integrations')
        .upsert(
          {
            user_id: user.id,
            provider: 'gmail',
            provider_user_id: providerUserId || null,
            access_token: tokens.access_token,
            refresh_token: refreshTokenToStore,
            token_data: tokenDataToStore,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,provider,provider_user_id' },
        )
      insertError = error
    } catch (error) {
      console.error('Exception storing Gmail tokens:', error)
      insertError = error as PostgrestError | Error
    }

    if (insertError) {
      console.error('Error storing Gmail tokens:', insertError)
      const targetUrl = redirectUrl.includes('?')
        ? `${redirectUrl}&integrationError=true`
        : `${redirectUrl}?integrationError=true`
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}${targetUrl}`)
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}${redirectUrl}`)
  } catch (error) {
    console.error('Error in Gmail OAuth callback:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/error?message=Failed to authenticate with Gmail`
    )
  }
}
