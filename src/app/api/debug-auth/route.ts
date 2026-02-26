import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// Dev-only endpoint - exposes auth debugging info
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const envVars = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleFitClientId: process.env.GOOGLE_FIT_CLIENT_ID,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    }

    const supabase = supabaseServer()
    const { data: authSettings } = await supabase.auth.getSession()

    return NextResponse.json({
      env: {
        supabaseUrl: envVars.supabaseUrl ? 'Set' : 'Missing',
        googleClientId: envVars.googleClientId ? 'Set' : 'Missing',
        googleFitClientId: envVars.googleFitClientId ? 'Set' : 'Missing',
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
