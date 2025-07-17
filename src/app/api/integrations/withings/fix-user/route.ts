import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Use service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { old_user_id, new_user_id } = await request.json()

    if (!old_user_id || !new_user_id) {
      return NextResponse.json({ 
        error: 'Missing required fields: old_user_id, new_user_id' 
      }, { status: 400 })
    }

    // Update the user_id for the Withings integration
    const { data, error } = await supabase
      .from('user_integrations')
      .update({
        user_id: new_user_id,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', old_user_id)
      .eq('provider', 'withings')
      .select()

    if (error) {
      console.error('Fix user error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No Withings integration found to update' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Withings integration user updated successfully',
      data 
    })
  } catch (error) {
    console.error('Fix user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}