import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  // Block in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_ADMIN_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Require authentication
  const supabaseAuth = supabaseServer()
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Require admin secret header
  const adminSecret = request.headers.get('x-admin-secret')
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const supabase = supabaseServer()

    // Check if tables exist by trying to query them
    const { error: mealError } = await supabase
      .from('meal_entries')
      .select('count')
      .limit(1)
    
    const { error: goalsError } = await supabase
      .from('nutrition_goals')
      .select('count')
      .limit(1)
    
    const { error: favoritesError } = await supabase
      .from('favorite_foods')
      .select('count')
      .limit(1)

    const tablesExist = {
      meal_entries: !mealError,
      nutrition_goals: !goalsError,
      favorite_foods: !favoritesError
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Table status checked',
      tablesExist,
      instructions: 'Please create the tables manually in Supabase dashboard using the SQL from create-meal-tracking.sql'
    })
  } catch (error) {
    console.error('Migration check error:', error)
    return NextResponse.json({ error: 'Migration check failed' }, { status: 500 })
  }
}
