import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Use service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { access_token, refresh_token, user_id, expires_in } = await request.json()

    if (!access_token || !refresh_token || !user_id) {
      return NextResponse.json({
        error: 'Missing required fields: access_token, refresh_token, user_id'
      }, { status: 400 })
    }

    // Update the existing Withings integration
    const { data, error } = await supabase
      .from('user_integrations')
      .update({
        access_token: access_token,
        refresh_token: refresh_token,
        token_data: {
          access_token,
          refresh_token,
          expires_in: expires_in ?? 10800, // Withings default is 3 hours
          token_type: 'Bearer'
        },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user_id)
      .eq('provider', 'withings')
      .select()

    if (error) {
      console.error('Update tokens error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No Withings integration found to update' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Withings tokens updated successfully',
      data 
    })
  } catch (error) {
    console.error('Update tokens error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}