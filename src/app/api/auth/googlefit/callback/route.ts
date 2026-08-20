import { NextRequest, NextResponse } from 'next/server'
import { exchangeGoogleFitCodeForToken } from '@/lib/googlefit/client'
import { supabaseServer } from '@/utils/supabase/server'
import { sanitizeRedirectUrl } from '@/lib/url-utils'
import { verifyOAuthState } from '@/lib/oauth-state'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const verifiedState = verifyOAuthState(state)
  if (!verifiedState) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/login?error=Invalid or expired OAuth state`)
  }
  let redirectUrl = sanitizeRedirectUrl(verifiedState.redirectUrl)

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/error?message=No authorization code from Google`,
    )
  }

  try {
    const tokenData = await exchangeGoogleFitCodeForToken(code)

    const supabase = supabaseServer()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.id !== verifiedState.userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/login?error=OAuth session mismatch, please try again`,
      )
    }

    const { error: upsertError } = await supabase.from('user_integrations').upsert(
      {
        user_id: user.id,
        provider: 'google-fit',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_data: tokenData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    )

    if (upsertError) {
      console.error('Failed to store Google Fit tokens', upsertError)
      redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + 'integrationError=true'
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}${redirectUrl}`)
  } catch (err) {
    console.error('Google Fit OAuth callback error', err)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/error?message=Google Fit authentication failed`,
    )
  }
}
