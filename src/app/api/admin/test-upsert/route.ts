import { NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';

/**
 * Test endpoint to diagnose upsert issues
 * Usage: GET /api/admin/test-upsert
 * Requires: authenticated admin user + ADMIN_SECRET header
 */
export async function GET(request: Request) {
  // Block in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_ADMIN_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Require admin secret header
  const adminSecret = request.headers.get('x-admin-secret');
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const supabase = supabaseServer();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated', details: authError?.message },
        { status: 401 }
      );
    }

    // Try a simple upsert
    const testData = {
      user_id: user.id,
      life_buckets: ['Test Bucket'],
      bucket_colors: { 'Test Bucket': 'blue' },
      widgets_by_bucket: { 'Test Bucket': [] },
      progress_by_widget: {},
      hourly_plan: {},
    };

    // Try upsert
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(testData, { onConflict: 'user_id' })
      .select();

    if (error) {
      return NextResponse.json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
        testData,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Upsert successful',
      data,
      testData,
    });

  } catch (error) {
    console.error('Exception in test-upsert:', error);
    return NextResponse.json(
      {
        error: 'Exception occurred',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
