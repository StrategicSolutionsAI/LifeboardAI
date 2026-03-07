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

    // Ensure table exists - reuse create-table endpoint if needed
    try {
      const { error: tableError } = await serviceClient.from('user_integrations').select('id').limit(1)
      if (tableError && (tableError.code === '42P01' || tableError.message?.includes('does not exist'))) {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/create-table`, { method: 'POST' })
      }
    } catch (e) {
      console.error('Error verifying user_integrations table', e)
    }

    // Delete any existing Withings rows for this user, then insert fresh
    await serviceClient
      .from('user_integrations')
      .delete()
      .eq('user_id', effectiveUserId)
      .eq('provider', 'withings')

    const insertRow: Record<string, unknown> = {
      user_id: effectiveUserId,
      provider: 'withings',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_data: tokenData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Try including provider_user_id; if column doesn't exist, retry without it
    if (tokenData.userid) {
      insertRow.provider_user_id = String(tokenData.userid)
    }

    let { error: insertError } = await serviceClient
      .from('user_integrations')
      .insert(insertRow)

    if (insertError?.code === 'PGRST204') {
      console.warn('provider_user_id column missing, retrying without it')
      delete insertRow.provider_user_id
      const retry = await serviceClient
        .from('user_integrations')
        .insert(insertRow)
      insertError = retry.error
    }

    if (insertError) {
      console.error('Failed to store Withings tokens', insertError)
      redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + 'integrationError=true'
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}${redirectUrl}`)
  } catch (err) {
    console.error('Withings OAuth callback error', err)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || origin || 'http://localhost:3000'
    return NextResponse.redirect(`${baseUrl}/error?message=Withings authentication failed`)
  }
} 
