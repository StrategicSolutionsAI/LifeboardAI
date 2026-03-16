import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchWithingsLatestWeight, refreshWithingsToken } from '@/lib/withings/client'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Verify Withings webhook signature.
 * Withings signs the raw body with HMAC-SHA256 using your client secret.
 * The signature is sent in the `X-Withings-Signature` header.
 */
function verifyWithingsSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WITHINGS_CLIENT_SECRET
  if (!secret) {
    console.warn('WITHINGS_CLIENT_SECRET not set — skipping signature verification')
    // In production, reject unsigned requests when secret is configured
    return process.env.NODE_ENV !== 'production'
  }
  if (!signature) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  )
}

/** Check whether the stored token is expired or about to expire (within 60s). */
function isTokenExpired(tokenData: Record<string, unknown> | null, updatedAt: string | null): boolean {
  if (!tokenData?.expires_in || !updatedAt) return true
  const expiresIn = Number(tokenData.expires_in)
  const issuedAt = new Date(updatedAt).getTime()
  const expiresAt = issuedAt + expiresIn * 1000
  return Date.now() >= expiresAt - 60_000 // 60s buffer
}

// Withings webhook endpoint for real-time weight updates
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    // Verify webhook signature
    const signature = request.headers.get('x-withings-signature')
    if (!verifyWithingsSignature(rawBody, signature)) {
      console.warn('Withings webhook signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)

    // Withings webhook payload structure
    const { userid, appli, startdate } = body

    // Verify this is a weight measurement notification (appli = 1 for weight)
    if (appli !== 1) {
      return NextResponse.json({ message: 'Not a weight measurement' }, { status: 200 })
    }

    // Service role client — webhook has no user session, can't use cookie-based client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('id, user_id, access_token, refresh_token, token_data, updated_at')
      .eq('provider', 'withings')
      .eq('provider_user_id', userid.toString())
      .maybeSingle()

    if (integrationError || !integration) {
      console.error('User integration not found:', integrationError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let accessToken = integration.access_token as string
    const refreshToken = integration.refresh_token as string

    // Proactive token refresh if expired or about to expire
    if (isTokenExpired(integration.token_data as Record<string, unknown> | null, integration.updated_at as string | null)) {
      try {
        const refreshed = await refreshWithingsToken(refreshToken)
        accessToken = refreshed.access_token

        await supabase
          .from('user_integrations')
          .update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token ?? refreshToken,
            token_data: refreshed,
            updated_at: new Date().toISOString(),
          })
          .eq('id', integration.id)
      } catch (refreshErr) {
        console.error('Proactive Withings token refresh failed:', refreshErr)
        // Continue with existing token — it may still work
      }
    }

    // Fetch the latest weight data, with retry-on-401
    let weightKg: number
    try {
      weightKg = await fetchWithingsLatestWeight(accessToken)
    } catch (fetchError) {
      // Retry once on INVALID_TOKEN (expired token that slipped past the expiry check)
      if (fetchError instanceof Error && fetchError.message === 'INVALID_TOKEN') {
        try {
          const refreshed = await refreshWithingsToken(refreshToken)
          accessToken = refreshed.access_token

          await supabase
            .from('user_integrations')
            .update({
              access_token: refreshed.access_token,
              refresh_token: refreshed.refresh_token ?? refreshToken,
              token_data: refreshed,
              updated_at: new Date().toISOString(),
            })
            .eq('id', integration.id)

          weightKg = await fetchWithingsLatestWeight(accessToken)
        } catch (retryErr) {
          console.error('Withings retry after token refresh failed:', retryErr)
          return NextResponse.json({ error: 'Failed to fetch weight data after token refresh' }, { status: 500 })
        }
      } else {
        console.error('Error fetching weight data:', fetchError)
        return NextResponse.json({ error: 'Failed to fetch weight data' }, { status: 500 })
      }
    }

    const { error: insertError } = await supabase
      .from('weight_measurements')
      .insert({
        user_id: integration.user_id,
        weight_kg: weightKg,
        weight_lbs: Math.round(weightKg * 2.20462 * 10) / 10,
        measured_at: new Date(startdate * 1000).toISOString(),
        source: 'withings',
        raw_data: body
      })

    if (insertError) {
      console.error('Error storing weight measurement:', insertError)
    }

    return NextResponse.json({
      message: 'Weight data processed successfully',
      weightKg
    }, { status: 200 })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({
      error: 'Webhook processing failed',
    }, { status: 500 })
  }
}

// Handle webhook verification (GET request)
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const challenge = url.searchParams.get('challenge')

  if (challenge) {
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({ message: 'Withings webhook endpoint' }, { status: 200 })
}
