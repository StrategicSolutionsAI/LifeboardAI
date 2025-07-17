import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

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

    // Delete the integration
    const { error: deleteError } = await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider)

    if (deleteError) {
      console.error('Failed to disconnect integration:', deleteError)
      return NextResponse.json({ error: 'Failed to disconnect integration' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `${provider} disconnected successfully` })
  } catch (error) {
    console.error('Disconnect API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}