import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  // Compute origin from env or request (so localhost port mismatches don't break OAuth)
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`

  // If no code, redirect to Todoist OAuth
  if (!code) {
    const clientId = process.env.TODOIST_CLIENT_ID
    const redirectUri = `${origin}/api/integrations/todoist/auth`
    
    if (!clientId) {
      return NextResponse.json({ error: 'Todoist client ID not configured' }, { status: 500 })
    }

    const authUrl = new URL('https://todoist.com/oauth/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('scope', 'data:read_write')
    authUrl.searchParams.set('state', 'lifeboard-integration')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)

    return NextResponse.redirect(authUrl.toString())
  }

  // Handle OAuth callback
  try {
    const supabase = supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/login?error=unauthorized`)
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://todoist.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.TODOIST_CLIENT_ID!,
        client_secret: process.env.TODOIST_CLIENT_SECRET!,
        code,
        redirect_uri: `${origin}/api/integrations/todoist/auth`,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token')
    }

    const tokenData = await tokenResponse.json()
    
    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error)
    }

    // Store the integration in the database
    const { error: upsertError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: user.id,
        provider: 'todoist',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider'
      })

    if (upsertError) {
      console.error('Error storing Todoist integration:', upsertError)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/integrations?error=storage_failed`)
    }

    // Redirect back to integrations page with success
    return NextResponse.redirect(`${origin}/integrations?success=todoist_connected`)
    
  } catch (error) {
    console.error('Todoist OAuth error:', error)
    return NextResponse.redirect(`${origin}/integrations?error=oauth_failed`)
  }
}
