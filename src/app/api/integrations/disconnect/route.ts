import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { handleApiError } from '@/lib/api-error-handler'

export async function POST(request: NextRequest) {
  try {
    const { provider } = await request.json()

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 })
    }

    const supabase = supabaseServer()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if integration exists
    const { data: existingIntegration, error: checkError } = await supabase
      .from('user_integrations')
      .select('id, provider')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking existing integration:', checkError)
      return NextResponse.json({ error: 'Error checking integration' }, { status: 500 })
    }

    if (!existingIntegration) {
      return NextResponse.json({ success: true, message: `${provider} was not connected` })
    }

    // Delete the integration using the standard RLS client
    // (DELETE policy was added in migration 20250724_add_delete_policy_user_integrations.sql)
    const { error: deleteError } = await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider)

    if (deleteError) {
      console.error('Failed to disconnect integration:', deleteError)
      return NextResponse.json({ error: 'Failed to disconnect integration' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${provider} disconnected successfully`
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/integrations/disconnect')
  }
}
