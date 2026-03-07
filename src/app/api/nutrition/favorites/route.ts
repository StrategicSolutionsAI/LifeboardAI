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

    const { data: favorites, error } = await supabase
      .from('favorite_foods')
      .select('*')
      .eq('user_id', user.id)
      .order('added_count', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching favorite foods:', error)
      return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 })
    }

    const formattedFavorites = favorites?.map((fav: Record<string, unknown>) => ({
      id: fav.food_id,
      food_name: fav.food_name,
      serving: fav.serving_data,
      added_count: fav.added_count,
      last_added: fav.last_added
    })) || []

    return NextResponse.json(formattedFavorites)
  } catch (error) {
    return handleApiError(error, 'GET /api/nutrition/favorites')
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
    const { food_id, food_name, serving } = body

    if (!food_id || !food_name || !serving) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // First get current count (if exists) so we can increment
    const { data: existing } = await supabase
      .from('favorite_foods')
      .select('added_count')
      .eq('user_id', user.id)
      .eq('food_id', food_id)
      .maybeSingle()

    const newCount = (existing?.added_count ?? 0) + 1

    const { data: result, error: upsertError } = await supabase
      .from('favorite_foods')
      .upsert(
        {
          user_id: user.id,
          food_id,
          food_name,
          serving_data: serving,
          added_count: newCount,
          last_added: new Date().toISOString()
        },
        { onConflict: 'user_id,food_id' }
      )
      .select()
      .single()

    if (upsertError) {
      console.error('Error upserting favorite:', upsertError)
      return NextResponse.json({ error: 'Failed to save favorite' }, { status: 500 })
    }

    return NextResponse.json({
      id: result.food_id,
      food_name: result.food_name,
      serving: result.serving_data,
      added_count: result.added_count,
      last_added: result.last_added
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/nutrition/favorites')
  }
}
