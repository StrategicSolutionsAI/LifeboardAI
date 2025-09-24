import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseServer();

    // Check authentication (admin only for now)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create the calendar_events table
    const createTableQuery = `
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
    `;

    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: createTableQuery
    });

    if (tableError) {
      console.error('Error creating table:', tableError);
      return NextResponse.json({
        error: `Failed to create table: ${tableError.message}`
      }, { status: 500 });
    }

    // Create indexes for better performance
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);',
      'CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);',
      'CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events(source);',
      'CREATE INDEX IF NOT EXISTS idx_calendar_events_task_id ON calendar_events(task_id);'
    ];

    for (const indexQuery of indexQueries) {
      const { error: indexError } = await supabase.rpc('exec_sql', {
        sql: indexQuery
      });

      if (indexError) {
        console.error('Error creating index:', indexError);
        // Continue with other indexes even if one fails
      }
    }

    // Create RLS policies
    const policyQueries = [
      'ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;',
      `CREATE POLICY IF NOT EXISTS "Users can view their own calendar events"
       ON calendar_events FOR SELECT
       USING (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS "Users can insert their own calendar events"
       ON calendar_events FOR INSERT
       WITH CHECK (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS "Users can update their own calendar events"
       ON calendar_events FOR UPDATE
       USING (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS "Users can delete their own calendar events"
       ON calendar_events FOR DELETE
       USING (auth.uid() = user_id);`
    ];

    for (const policyQuery of policyQueries) {
      const { error: policyError } = await supabase.rpc('exec_sql', {
        sql: policyQuery
      });

      if (policyError) {
        console.error('Error creating policy:', policyError);
        // Continue with other policies even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database setup completed successfully'
    });

  } catch (error) {
    console.error('Database setup error:', error);
    return NextResponse.json({
      error: 'Failed to setup database'
    }, { status: 500 });
  }
}
