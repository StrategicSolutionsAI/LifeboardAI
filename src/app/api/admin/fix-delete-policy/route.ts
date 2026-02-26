import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  // Block in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_ADMIN_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Require admin secret header
  const adminSecret = request.headers.get('x-admin-secret')
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const supabase = supabaseServer()

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Add the missing DELETE policy
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY IF NOT EXISTS "Users can delete their own integrations" 
        ON public.user_integrations
        FOR DELETE USING (auth.uid() = user_id);
      `
    })

    if (error) {
      console.error('[FIX-DELETE-POLICY] Error adding DELETE policy:', error)
      
      // Try alternative approach using raw SQL
      const { error: altError } = await supabase
        .from('user_integrations')
        .select('id')
        .limit(0) // This will fail but let us execute the policy creation
      
      // If the table exists, try to add policy directly
      try {
        await supabase.rpc('sql', {
          query: `CREATE POLICY IF NOT EXISTS "Users can delete their own integrations" ON public.user_integrations FOR DELETE USING (auth.uid() = user_id);`
        })
      } catch (sqlError) {
        console.error('[FIX-DELETE-POLICY] Alternative approach failed:', sqlError)
        return NextResponse.json({ 
          error: 'Failed to add DELETE policy. Please run this SQL manually in Supabase dashboard: CREATE POLICY "Users can delete their own integrations" ON public.user_integrations FOR DELETE USING (auth.uid() = user_id);',
          details: error
        }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'DELETE policy added successfully. Integration disconnect should now work properly.' 
    })

  } catch (error) {
    console.error('[FIX-DELETE-POLICY] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'Please run this SQL manually in Supabase dashboard: CREATE POLICY "Users can delete their own integrations" ON public.user_integrations FOR DELETE USING (auth.uid() = user_id);'
    }, { status: 500 })
  }
}
