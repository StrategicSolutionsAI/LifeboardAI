import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();

    // Fetch existing preferences
    const { data: existingPrefs, error: fetchError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // Ignore 'not found' error
      console.error('Error fetching existing preferences:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const existingBuckets = existingPrefs?.life_buckets || [];
    const existingWidgets = existingPrefs?.widgets_by_bucket || {};
    
    const newBuckets = body.life_buckets || [];
    const newWidgets = body.widgets_by_bucket || {};

    // Merge and deduplicate buckets
    const combinedBuckets = Array.from(new Set([...existingBuckets, ...newBuckets]));
    
    // Merge widgets - new widgets take precedence
    const combinedWidgets = { ...existingWidgets, ...newWidgets };

    // Prepare the update data
    const updateData: any = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    // Only update fields that are provided in the request
    if (body.life_buckets !== undefined) {
      updateData.life_buckets = combinedBuckets;
    }
    if (body.widgets_by_bucket !== undefined) {
      updateData.widgets_by_bucket = combinedWidgets;
    }

    // If neither field is provided, just use existing data
    if (body.life_buckets === undefined && body.widgets_by_bucket === undefined) {
      updateData.life_buckets = existingBuckets;
      updateData.widgets_by_bucket = existingWidgets;
    }

    // Now save the merged user preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(updateData, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving preferences:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in save preferences endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is ok
      console.error('Error fetching preferences:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || { 
      life_buckets: [], 
      widgets_by_bucket: {} 
    });
  } catch (error) {
    console.error('Error in get preferences endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
