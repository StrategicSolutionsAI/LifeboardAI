import { NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import { withErrorHandling, createApiError } from '@/lib/api-error-handler';

async function postHandler(request: Request) {
  const supabase = supabaseServer();
  const authResult = await supabase.auth.getUser();
  const user = authResult?.data?.user;
  
  if (!user) {
    // Tests expect 'Unauthorized' string
    throw createApiError('Unauthorized', 401, 'AUTH_REQUIRED');
  }
  
  const body = await request.json();

  // Validate request body
  if (!body || typeof body !== 'object') {
    throw createApiError('Invalid request body', 400, 'INVALID_BODY');
  }

  // Fetch existing preferences
  const { data: existingPrefs, error: fetchError } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') { // Ignore 'not found' error
    throw createApiError(
      'Failed to fetch existing preferences', 
      500, 
      'DB_FETCH_ERROR', 
      fetchError
    );
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
    const updateData: Record<string, unknown> = {
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
    throw createApiError(
      'Failed to save preferences', 
      500, 
      'DB_SAVE_ERROR', 
      error
    );
  }

  return NextResponse.json(data);
}

async function getHandler(request: Request) {
  const supabase = supabaseServer();
  const authResult = await supabase.auth.getUser();
  const user = authResult?.data?.user;
  
  if (!user) {
    // Tests expect 'Unauthorized' string
    throw createApiError('Unauthorized', 401, 'AUTH_REQUIRED');
  }
  
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // Not found is ok
    throw createApiError(
      'Failed to fetch preferences', 
      500, 
      'DB_FETCH_ERROR', 
      error
    );
  }

  return NextResponse.json(data || { 
    life_buckets: [], 
    widgets_by_bucket: {} 
  });
}

// Export handlers with error handling
export const POST = withErrorHandling(postHandler, 'user/preferences/POST');
export const GET = withErrorHandling(getHandler, 'user/preferences/GET');
