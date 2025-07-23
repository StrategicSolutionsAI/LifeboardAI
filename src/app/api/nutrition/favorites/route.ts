import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'

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

    const formattedFavorites = favorites?.map((fav: any) => ({
      id: fav.food_id,
      food_name: fav.food_name,
      serving: fav.serving_data,
      added_count: fav.added_count,
      last_added: fav.last_added
    })) || []

    return NextResponse.json(formattedFavorites)
  } catch (error) {
    console.error('Error in favorites GET API:', error)
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
    const { food_id, food_name, serving } = body

    if (!food_id || !food_name || !serving) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if favorite already exists
    const { data: existing, error: checkError } = await supabase
      .from('favorite_foods')
      .select('*')
      .eq('user_id', user.id)
      .eq('food_id', food_id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing favorite:', checkError)
      return NextResponse.json({ error: 'Failed to check favorite' }, { status: 500 })
    }

    if (existing) {
      // Update existing favorite
      const { data: updated, error: updateError } = await supabase
        .from('favorite_foods')
        .update({
          added_count: existing.added_count + 1,
          last_added: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating favorite:', updateError)
        return NextResponse.json({ error: 'Failed to update favorite' }, { status: 500 })
      }

      return NextResponse.json({
        id: updated.food_id,
        food_name: updated.food_name,
        serving: updated.serving_data,
        added_count: updated.added_count,
        last_added: updated.last_added
      })
    } else {
      // Create new favorite
      const { data: newFavorite, error: insertError } = await supabase
        .from('favorite_foods')
        .insert({
          user_id: user.id,
          food_id,
          food_name,
          serving_data: serving,
          added_count: 1,
          last_added: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating favorite:', insertError)
        return NextResponse.json({ error: 'Failed to create favorite' }, { status: 500 })
      }

      return NextResponse.json({
        id: newFavorite.food_id,
        food_name: newFavorite.food_name,
        serving: newFavorite.serving_data,
        added_count: newFavorite.added_count,
        last_added: newFavorite.last_added
      })
    }
  } catch (error) {
    console.error('Error in favorites POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
