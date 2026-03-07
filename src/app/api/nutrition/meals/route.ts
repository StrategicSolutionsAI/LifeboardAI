import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { handleApiError } from '@/lib/api-error-handler'

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const { data: meals, error } = await supabase
      .from('meal_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('meal_date', date)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching meals:', error)
      return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 })
    }

    // Group meals by meal type
    const groupedMeals: {
      breakfast: Record<string, unknown>[]
      lunch: Record<string, unknown>[]
      dinner: Record<string, unknown>[]
      snacks: Record<string, unknown>[]
    } = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: []
    }

    meals?.forEach((meal: Record<string, unknown>) => {
      if (groupedMeals[meal.meal_type as keyof typeof groupedMeals]) {
        groupedMeals[meal.meal_type as keyof typeof groupedMeals].push({
          id: meal.id,
          food_name: meal.food_name,
          serving: meal.serving_data,
          quantity: parseFloat(String(meal.quantity)),
          meal_type: meal.meal_type,
          added_at: meal.created_at
        })
      }
    })

    const res = NextResponse.json(groupedMeals)
    res.headers.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=30')
    return res
  } catch (error) {
    return handleApiError(error, 'GET /api/nutrition/meals')
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
    const { food_id, food_name, serving, quantity, meal_type, meal_date } = body

    if (!food_id || !food_name || !serving || !quantity || !meal_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: meal, error } = await supabase
      .from('meal_entries')
      .insert({
        user_id: user.id,
        food_id,
        food_name,
        serving_data: serving,
        quantity: parseFloat(quantity),
        meal_type,
        meal_date: meal_date || new Date().toISOString().split('T')[0]
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding meal:', error)
      return NextResponse.json({ error: 'Failed to add meal' }, { status: 500 })
    }

    return NextResponse.json({
      id: meal.id,
      food_name: meal.food_name,
      serving: meal.serving_data,
      quantity: parseFloat(String(meal.quantity)),
      meal_type: meal.meal_type,
      added_at: meal.created_at
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/nutrition/meals')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mealId = searchParams.get('id')

    if (!mealId) {
      return NextResponse.json({ error: 'Meal ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('meal_entries')
      .delete()
      .eq('id', mealId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting meal:', error)
      return NextResponse.json({ error: 'Failed to delete meal' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'DELETE /api/nutrition/meals')
  }
}
