import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = supabaseServer()
    
    // Test basic connection
    const { data, error } = await supabase.from('profiles').select('count').limit(1)
    
    if (error) {
      console.error('Supabase test error:', error)
      return NextResponse.json({ status: 'error', message: error.message, details: error }, { status: 500 })
    }
    
    return NextResponse.json({ status: 'ok', data })
  } catch (e) {
    console.error('Unexpected error:', e)
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
