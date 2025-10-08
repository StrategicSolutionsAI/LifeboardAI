import { NextRequest, NextResponse } from 'next/server'
import { exchangeGoogleFitCodeForToken } from '@/lib/googlefit/client'
import { supabaseServer } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  let redirectUrl = '/dashboard'
  let userIdFromState = ''

  if (state) {
    try {
      const s = JSON.parse(decodeURIComponent(state))
      if (s.redirectUrl) redirectUrl = s.redirectUrl
      if (s.userId) userIdFromState = s.userId
    } catch (e) {
      console.error('Failed to parse state param', e)
    }
  }

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

    const effectiveUserId = user?.id || userIdFromState

    if (!effectiveUserId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/login?error=User not authenticated`,
      )
    }

    // Ensure table exists
    try {
      const { error: tableError } = await supabase
        .from('user_integrations')
        .select('id')
        .limit(1)
      if (
        tableError &&
        (tableError.code === '42P01' || tableError.message?.includes('does not exist'))
      ) {
        await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/create-table`,
          { method: 'POST' },
        )
      }
    } catch (e) {
      console.error('Error verifying user_integrations table', e)
    }

    // Upsert tokens
    const { error: upsertError } = await supabase.from('user_integrations').upsert(
      {
        user_id: effectiveUserId,
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
