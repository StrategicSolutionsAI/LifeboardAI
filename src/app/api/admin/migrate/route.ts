import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { validateAdminAuth } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  const authError = await validateAdminAuth(request)
  if (authError) return authError

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
