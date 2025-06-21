import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Get the user ID and provider from the query parameters
    const searchParams = request.nextUrl.searchParams;
    const provider = searchParams.get('provider');
    
    // Get the current user
    const supabase = supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ 
        connected: false, 
        message: 'User not authenticated' 
      }, { status: 401 });
    }

    if (!provider) {
      return NextResponse.json({ 
        connected: false, 
        message: 'Provider parameter is required' 
      }, { status: 400 });
    }

    // Check if the user has an integration for the specified provider
    const { data: integration, error } = await supabase
      .from('user_integrations')
      .select('id, access_token, updated_at')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .maybeSingle();

    if (error) {
      console.error('Error fetching integration status:', error);
      return NextResponse.json({ 
        connected: false, 
        message: 'Error fetching integration status' 
      }, { status: 500 });
    }

    // Return the integration status
    return NextResponse.json({
      connected: !!integration?.access_token,
      lastUpdated: integration?.updated_at || null,
      integrationId: integration?.id || null
    });
    
  } catch (error) {
    console.error('Error in integration status endpoint:', error);
    return NextResponse.json({ 
      connected: false, 
      message: 'Server error' 
    }, { status: 500 });
  }
}
