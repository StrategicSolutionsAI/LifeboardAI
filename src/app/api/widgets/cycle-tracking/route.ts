import { NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import { withErrorHandling, createApiError } from '@/lib/api-error-handler';

async function getHandler(request: Request) {
  const supabase = supabaseServer();
  const authResult = await supabase.auth.getUser();
  const user = authResult?.data?.user;

  if (!user) {
    throw createApiError('Unauthorized', 401, 'AUTH_REQUIRED');
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') || 90), 365);

  const { data, error } = await supabase
    .from('cycle_tracking')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    throw createApiError('Failed to fetch cycle data', 500, 'DB_FETCH_ERROR', error);
  }

  return NextResponse.json({ entries: data || [] });
}

async function postHandler(request: Request) {
  const supabase = supabaseServer();
  const authResult = await supabase.auth.getUser();
  const user = authResult?.data?.user;

  if (!user) {
    throw createApiError('Unauthorized', 401, 'AUTH_REQUIRED');
  }

  const body = await request.json();

  if (!body || !body.date) {
    throw createApiError('date is required', 400, 'INVALID_BODY');
  }

  const row = {
    user_id: user.id,
    date: body.date,
    flow_intensity: body.flow_intensity || 'none',
    symptoms: body.symptoms || [],
    mood: body.mood ?? null,
    notes: body.notes || null,
    period_start: body.period_start ?? false,
  };

  const { data, error } = await supabase
    .from('cycle_tracking')
    .upsert(row, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) {
    throw createApiError('Failed to save cycle entry', 500, 'DB_SAVE_ERROR', error);
  }

  return NextResponse.json(data);
}

async function deleteHandler(request: Request) {
  const supabase = supabaseServer();
  const authResult = await supabase.auth.getUser();
  const user = authResult?.data?.user;

  if (!user) {
    throw createApiError('Unauthorized', 401, 'AUTH_REQUIRED');
  }

  const url = new URL(request.url);
  const date = url.searchParams.get('date');

  if (!date) {
    throw createApiError('date query param is required', 400, 'INVALID_PARAMS');
  }

  const { error } = await supabase
    .from('cycle_tracking')
    .delete()
    .eq('user_id', user.id)
    .eq('date', date);

  if (error) {
    throw createApiError('Failed to delete cycle entry', 500, 'DB_DELETE_ERROR', error);
  }

  return NextResponse.json({ success: true });
}

export const GET = withErrorHandling(getHandler, 'widgets/cycle-tracking/GET');
export const POST = withErrorHandling(postHandler, 'widgets/cycle-tracking/POST');
export const DELETE = withErrorHandling(deleteHandler, 'widgets/cycle-tracking/DELETE');
