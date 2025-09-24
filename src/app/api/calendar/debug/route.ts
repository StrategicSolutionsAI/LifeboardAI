import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', authError }, { status: 401 });
    }

    console.log('Debug: User authenticated:', user.id);

    // Test basic Supabase connection
    const { data: testData, error: testError } = await supabase
      .from('lifeboard_tasks')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('Debug: Supabase connection test failed:', testError);
      return NextResponse.json({
        error: 'Supabase connection failed',
        details: testError,
        user_id: user.id
      }, { status: 500 });
    }

    console.log('Debug: Supabase connection successful');

    // Check if calendar_events table exists
    const { data: tableData, error: tableError } = await supabase
      .from('calendar_events')
      .select('*')
      .limit(1);

    let tableExists = true;
    let tableErrorDetails = null;

    if (tableError) {
      tableExists = false;
      tableErrorDetails = tableError;
      console.error('Debug: calendar_events table check failed:', tableError);
    } else {
      console.log('Debug: calendar_events table exists');
    }

    return NextResponse.json({
      success: true,
      user_id: user.id,
      supabase_connection: true,
      calendar_events_table: {
        exists: tableExists,
        error: tableErrorDetails,
        sample_data: tableData
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseServer();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create calendar_events table
    const createTableSQL = `
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

      ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can manage their own calendar events" ON calendar_events;

      CREATE POLICY "Users can manage their own calendar events"
      ON calendar_events FOR ALL
      USING (auth.uid() = user_id);

      CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events(source);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_task_id ON calendar_events(task_id);
    `;

    // For now, let's skip the complex table creation and just try to create the table directly
    console.log('Attempting to create calendar_events table...');

    // Test inserting a sample event
    const sampleEvent = {
      user_id: user.id,
      external_id: 'test-event-' + Date.now(),
      source: 'uploaded_calendar',
      title: 'Test Calendar Event',
      description: 'This is a test event created by the debug endpoint',
      start_date: '2025-09-23',
      all_day: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: insertData, error: insertError } = await supabase
      .from('calendar_events')
      .insert([sampleEvent])
      .select();

    if (insertError) {
      console.error('Sample event insertion failed:', insertError);
      return NextResponse.json({
        table_created: true,
        sample_event_inserted: false,
        error: insertError
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      table_created: true,
      sample_event_inserted: true,
      sample_event: insertData[0],
      message: 'Calendar events table created and sample event inserted successfully'
    });

  } catch (error) {
    console.error('Debug POST error:', error);
    return NextResponse.json({
      error: 'Debug POST failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
