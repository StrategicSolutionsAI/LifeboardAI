import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Check environment variables
    const envVars = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleFitClientId: process.env.GOOGLE_FIT_CLIENT_ID,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    }
    
    // Test Supabase connection
    const supabase = supabaseServer()
    const { data: authSettings } = await supabase.auth.getSession()
    
    // Return debugging information
    return NextResponse.json({
      env: {
        supabaseUrl: envVars.supabaseUrl ? '✅ Set' : '❌ Missing',
        googleClientId: envVars.googleClientId ? '✅ Set' : '❌ Missing',
        googleFitClientId: envVars.googleFitClientId ? '✅ Set' : '❌ Missing',
        siteUrl: envVars.siteUrl,
      },
      auth: {
        hasSession: !!authSettings.session,
      }
    })
  } catch (e) {
    console.error('Auth debug error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
