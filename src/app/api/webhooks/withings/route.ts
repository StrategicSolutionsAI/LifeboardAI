import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { fetchWithingsLatestWeight } from '@/lib/withings/client'

// Withings webhook endpoint for real-time weight updates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Withings webhook payload structure
    const { userid, appli, startdate, enddate } = body
    
    // Verify this is a weight measurement notification (appli = 1 for weight)
    if (appli !== 1) {
      return NextResponse.json({ message: 'Not a weight measurement' }, { status: 200 })
    }

    console.log('Withings webhook received:', { userid, appli, startdate, enddate })

    // Find the user with this Withings user ID
    const supabase = supabaseServer()
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('user_id, access_token, refresh_token, token_data')
      .eq('provider', 'withings')
      .eq('provider_user_id', userid.toString())
      .maybeSingle()

    if (integrationError || !integration) {
      console.error('User integration not found:', integrationError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch the latest weight data
    try {
      const weightKg = await fetchWithingsLatestWeight(integration.access_token)
      
      // Store the weight data in a weight_measurements table (create if doesn't exist)
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
        // Don't fail the webhook if storage fails
      }

      // Invalidate cache to force refresh on next request
      // This will be picked up by the useWithingsWeight hook
      console.log('New weight data received:', { weightKg, userId: integration.user_id })

      return NextResponse.json({ 
        message: 'Weight data processed successfully',
        weightKg 
      }, { status: 200 })

    } catch (fetchError) {
      console.error('Error fetching weight data:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to fetch weight data',
        details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Handle webhook verification (GET request)
export async function GET(request: NextRequest) {
  // Withings webhook verification
  const url = new URL(request.url)
  const challenge = url.searchParams.get('challenge')
  
  if (challenge) {
    return new Response(challenge, { status: 200 })
  }
  
  return NextResponse.json({ message: 'Withings webhook endpoint' }, { status: 200 })
}
