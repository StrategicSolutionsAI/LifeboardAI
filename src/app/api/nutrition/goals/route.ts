import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: goals, error } = await supabase
      .from('nutrition_goals')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching nutrition goals:', error)
      return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
    }

    // Return default goals if none exist
    if (!goals) {
      return NextResponse.json({
        calories: 2000,
        protein: 150,
        carbs: 250,
        fat: 65
      })
    }

    return NextResponse.json({
      calories: goals.calories,
      protein: goals.protein,
      carbs: goals.carbs,
      fat: goals.fat
    })
  } catch (error) {
    console.error('Error in nutrition goals GET API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { calories, protein, carbs, fat } = body

    if (!calories || !protein || !carbs || !fat) {
      return NextResponse.json({ error: 'All nutrition goals are required' }, { status: 400 })
    }

    const { data: goals, error } = await supabase
      .from('nutrition_goals')
      .upsert({
        user_id: user.id,
        calories: parseInt(calories),
        protein: parseInt(protein),
        carbs: parseInt(carbs),
        fat: parseInt(fat)
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving nutrition goals:', error)
      return NextResponse.json({ error: 'Failed to save goals' }, { status: 500 })
    }

    return NextResponse.json({
      calories: goals.calories,
      protein: goals.protein,
      carbs: goals.carbs,
      fat: goals.fat
    })
  } catch (error) {
    console.error('Error in nutrition goals POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
