import { NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';

/**
 * Test endpoint to diagnose upsert issues
 * Usage: GET /api/admin/test-upsert
 */
export async function GET() {
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

    console.log('Testing upsert with data:', testData);

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

  } catch (error: any) {
    console.error('Exception in test-upsert:', error);
    return NextResponse.json(
      { 
        error: 'Exception occurred',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
