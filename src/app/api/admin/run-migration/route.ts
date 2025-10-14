import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * API endpoint to run the user_preferences columns migration
 * This fixes the 400 error when saving user preferences
 * 
 * Usage: GET /api/admin/run-migration
 */
export async function GET() {
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

    // Run the migration SQL
    const migrationSQL = `
      -- Add bucket_colors column if it doesn't exist
      ALTER TABLE public.user_preferences
      ADD COLUMN IF NOT EXISTS bucket_colors JSONB DEFAULT '{}'::jsonb;

      -- Add progress_by_widget column if it doesn't exist
      ALTER TABLE public.user_preferences
      ADD COLUMN IF NOT EXISTS progress_by_widget JSONB DEFAULT '{}'::jsonb;

      -- Add hourly_plan column if it doesn't exist
      ALTER TABLE public.user_preferences
      ADD COLUMN IF NOT EXISTS hourly_plan JSONB DEFAULT '{}'::jsonb;
    `;

    const { error: migrationError } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (migrationError) {
      console.error('Migration error:', migrationError);
      
      // Try alternative approach - check columns directly
      const { data: columns, error: checkError } = await supabase
        .from('user_preferences')
        .select('*')
        .limit(1);

      if (checkError) {
        return NextResponse.json(
          { 
            error: 'Migration failed. Please run the SQL manually in Supabase dashboard.',
            details: migrationError.message,
            checkError: checkError.message,
            instructions: 'Go to Supabase Dashboard > SQL Editor and run the migration from: supabase/migrations/20251014_ensure_all_user_preferences_columns.sql'
          },
          { status: 500 }
        );
      }

      // Check if columns exist
      const sampleData = columns?.[0] || {};
      const hasRequiredColumns = 
        'bucket_colors' in sampleData &&
        'progress_by_widget' in sampleData &&
        'hourly_plan' in sampleData;

      if (hasRequiredColumns) {
        return NextResponse.json({
          success: true,
          message: 'All required columns already exist',
          columns: Object.keys(sampleData)
        });
      }

      return NextResponse.json(
        { 
          error: 'Missing columns detected',
          existingColumns: Object.keys(sampleData),
          requiredColumns: ['bucket_colors', 'progress_by_widget', 'hourly_plan'],
          instructions: 'Please run the migration SQL manually in Supabase Dashboard > SQL Editor',
          migrationFile: 'supabase/migrations/20251014_ensure_all_user_preferences_columns.sql'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Exception running migration:', error);
    return NextResponse.json(
      { 
        error: 'Failed to run migration',
        details: error.message,
        instructions: 'Please run the SQL manually in Supabase Dashboard > SQL Editor',
        migrationFile: 'supabase/migrations/20251014_ensure_all_user_preferences_columns.sql'
      },
      { status: 500 }
    );
  }
}
