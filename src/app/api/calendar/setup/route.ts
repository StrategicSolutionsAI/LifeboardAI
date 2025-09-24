import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseServer();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Setting up calendar_events table...');

    // Create a test record to trigger table creation via Supabase's schema inference
    const testEvent = {
      user_id: user.id,
      external_id: 'setup-test-' + Date.now(),
      source: 'uploaded_calendar',
      title: 'Setup Test Event',
      description: 'This is a test event created during table setup',
      start_date: '2025-09-23',
      all_day: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Try to insert the test event, which will create the table if it doesn't exist
    const { data: insertData, error: insertError } = await supabase
      .from('calendar_events')
      .insert([testEvent])
      .select();

    if (insertError) {
      console.error('Error setting up calendar_events table:', insertError);
      
      // If it's a table doesn't exist error, provide helpful instructions
      if (insertError.code === '42P01') {
        return NextResponse.json({
          error: 'Calendar events table needs to be created in Supabase',
          instructions: [
            '1. Go to your Supabase dashboard',
            '2. Navigate to the SQL Editor',
            '3. Run the migration file: supabase/migrations/20250922_create_calendar_events_table.sql',
            '4. Or manually create the table using the provided SQL'
          ],
          sqlToCopy: `-- Create calendar_events table for uploaded calendar files
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'uploaded_calendar',
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ,
    start_date DATE,
    end_time TIMESTAMPTZ,
    end_date DATE,
    timezone TEXT,
    location TEXT,
    all_day BOOLEAN DEFAULT FALSE,
    rrule TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    task_id UUID REFERENCES lifeboard_tasks(id) ON DELETE SET NULL,
    UNIQUE(user_id, external_id, source)
);

-- Enable Row Level Security
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own calendar events"
ON calendar_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar events"
ON calendar_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events"
ON calendar_events FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar events"
ON calendar_events FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events(source);
CREATE INDEX IF NOT EXISTS idx_calendar_events_task_id ON calendar_events(task_id);`
        }, { status: 500 });
      }

      return NextResponse.json({
        error: 'Failed to setup calendar events table',
        details: insertError
      }, { status: 500 });
    }

    // Clean up the test event
    if (insertData && insertData.length > 0) {
      await supabase
        .from('calendar_events')
        .delete()
        .eq('id', insertData[0].id);
    }

    return NextResponse.json({
      success: true,
      message: 'Calendar events table is ready for uploads',
      tableExists: true
    });

  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({
      error: 'Setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if table exists
    const { error: tableCheckError } = await supabase
      .from('calendar_events')
      .select('id')
      .limit(1);

    if (tableCheckError && tableCheckError.code === '42P01') {
      return NextResponse.json({
        tableExists: false,
        error: 'Calendar events table does not exist',
        needsSetup: true
      });
    } else if (tableCheckError) {
      return NextResponse.json({
        tableExists: false,
        error: tableCheckError.message,
        needsSetup: true
      });
    }

    return NextResponse.json({
      tableExists: true,
      message: 'Calendar events table is ready'
    });

  } catch (error) {
    console.error('Check error:', error);
    return NextResponse.json({
      error: 'Check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
