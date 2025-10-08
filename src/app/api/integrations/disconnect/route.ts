import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { provider } = await request.json()
    
    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 })
    }

    const supabase = supabaseServer()
    
    // Get session first
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const user = session.user
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // First check if integration exists
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

    // Delete the integration using service role to bypass RLS
    // This is a temporary workaround until the DELETE policy is added to the database
    const serviceRoleClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data: deleteData, error: deleteError } = await serviceRoleClient
      .from('user_integrations')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider)
      .select()

    if (deleteError) {
      console.error('Failed to disconnect integration:', deleteError)
      return NextResponse.json({ error: 'Failed to disconnect integration' }, { status: 500 })
    }

    // Verify deletion
    const { data: verifyData, error: verifyError } = await supabase
      .from('user_integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .maybeSingle()

    return NextResponse.json({ 
      success: true, 
      message: `${provider} disconnected successfully`,
      debug: {
        deletedRows: deleteData?.length || 0,
        stillExists: !!verifyData
      }
    })
  } catch (error) {
    console.error('Disconnect API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
