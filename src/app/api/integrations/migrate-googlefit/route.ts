import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

/**
 * Migration endpoint to update 'googlefit' provider to 'google-fit'
 * This fixes the mismatch between the callback and status check
 */
export async function POST() {
  const supabase = supabaseServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    // Check if there's an existing 'googlefit' record
    const { data: existingRecord } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'googlefit')
      .maybeSingle()

    if (!existingRecord) {
      return NextResponse.json({
        success: true,
        message: 'No migration needed - no googlefit record found'
      })
    }

    // Update the provider from 'googlefit' to 'google-fit'
    const { error: updateError } = await supabase
      .from('user_integrations')
      .update({ provider: 'google-fit' })
      .eq('user_id', user.id)
      .eq('provider', 'googlefit')

    if (updateError) {
      console.error('Migration failed', updateError)
      return NextResponse.json(
        { error: 'Migration failed', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully migrated Google Fit integration'
    })
  } catch (error) {
    console.error('Migration error', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
