import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminAuth } from '@/lib/admin-auth';

/**
 * API endpoint to check user_preferences table schema
 * This helps diagnose the 400 error when saving user preferences
 *
 * Usage: GET /api/admin/check-schema
 * Requires: authenticated admin user + ADMIN_SECRET header
 */
export async function GET(request: Request) {
  const authError = await validateAdminAuth(request);
  if (authError) return authError;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    // Create admin client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get a sample row to see what columns exist
    const { data: sampleData, error: sampleError } = await supabase
      .from('user_preferences')
      .select('*')
      .limit(1);

    if (sampleError) {
      return NextResponse.json(
        { 
          error: 'Failed to query user_preferences table',
          details: sampleError.message
        },
        { status: 500 }
      );
    }

    const existingColumns = sampleData && sampleData.length > 0 
      ? Object.keys(sampleData[0])
      : [];

    const requiredColumns = [
      'id',
      'user_id',
      'life_buckets',
      'widgets_by_bucket',
      'bucket_colors',
      'progress_by_widget',
      'hourly_plan',
      'created_at',
      'updated_at'
    ];

    const missingColumns = requiredColumns.filter(
      col => !existingColumns.includes(col)
    );

    const status = missingColumns.length === 0 ? 'OK' : 'MISSING_COLUMNS';

    return NextResponse.json({
      status,
      existingColumns,
      requiredColumns,
      missingColumns,
      message: missingColumns.length === 0
        ? 'All required columns exist'
        : `Missing columns: ${missingColumns.join(', ')}`,
      instructions: missingColumns.length > 0
        ? 'Run the migration: supabase/migrations/20251014_ensure_all_user_preferences_columns.sql'
        : null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Exception checking schema:', error);
    return NextResponse.json(
      {
        error: 'Failed to check schema',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
