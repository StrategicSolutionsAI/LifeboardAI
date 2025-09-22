import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';

interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  rrule?: string;
}

function parseICSFile(icsContent: string): ICSEvent[] {
  const events: ICSEvent[] = [];
  const lines = icsContent.split(/\r?\n/);

  let currentEvent: Partial<ICSEvent> | null = null;
  let currentProperty = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Handle line continuation (lines starting with space or tab)
    while (i + 1 < lines.length && /^[\s\t]/.test(lines[i + 1])) {
      i++;
      line += lines[i].trim();
    }

    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.uid && currentEvent.summary) {
        events.push(currentEvent as ICSEvent);
      }
      currentEvent = null;
    } else if (currentEvent && line.includes(':')) {
      const colonIndex = line.indexOf(':');
      const property = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);

      // Parse property and parameters
      const [propName, ...params] = property.split(';');
      const paramMap: Record<string, string> = {};

      params.forEach(param => {
        const [key, val] = param.split('=');
        if (key && val) {
          paramMap[key.toUpperCase()] = val;
        }
      });

      switch (propName.toUpperCase()) {
        case 'UID':
          currentEvent.uid = value;
          break;
        case 'SUMMARY':
          currentEvent.summary = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
          break;
        case 'DESCRIPTION':
          currentEvent.description = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
          break;
        case 'LOCATION':
          currentEvent.location = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
          break;
        case 'DTSTART':
          if (!currentEvent.start) currentEvent.start = {};
          if (paramMap.VALUE === 'DATE') {
            // All-day event
            currentEvent.start.date = formatDateOnly(value);
          } else {
            // Timed event
            currentEvent.start.dateTime = formatDateTime(value);
            if (paramMap.TZID) {
              currentEvent.start.timeZone = paramMap.TZID;
            }
          }
          break;
        case 'DTEND':
          if (!currentEvent.end) currentEvent.end = {};
          if (paramMap.VALUE === 'DATE') {
            // All-day event
            currentEvent.end.date = formatDateOnly(value);
          } else {
            // Timed event
            currentEvent.end.dateTime = formatDateTime(value);
            if (paramMap.TZID) {
              currentEvent.end.timeZone = paramMap.TZID;
            }
          }
          break;
        case 'RRULE':
          currentEvent.rrule = value;
          break;
      }
    }
  }

  return events;
}

function formatDateTime(icsDateTime: string): string {
  // ICS format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  if (icsDateTime.length === 15 && icsDateTime.endsWith('Z')) {
    // UTC time
    const year = icsDateTime.substring(0, 4);
    const month = icsDateTime.substring(4, 6);
    const day = icsDateTime.substring(6, 8);
    const hour = icsDateTime.substring(9, 11);
    const minute = icsDateTime.substring(11, 13);
    const second = icsDateTime.substring(13, 15);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  } else if (icsDateTime.length === 15) {
    // Local time
    const year = icsDateTime.substring(0, 4);
    const month = icsDateTime.substring(4, 6);
    const day = icsDateTime.substring(6, 8);
    const hour = icsDateTime.substring(9, 11);
    const minute = icsDateTime.substring(11, 13);
    const second = icsDateTime.substring(13, 15);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  }
  return icsDateTime;
}

function formatDateOnly(icsDate: string): string {
  // ICS format: YYYYMMDD
  if (icsDate.length === 8) {
    const year = icsDate.substring(0, 4);
    const month = icsDate.substring(4, 6);
    const day = icsDate.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  return icsDate;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseServer();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.endsWith('.ics') && !file.name.endsWith('.ical')) {
      return NextResponse.json({
        error: 'Invalid file type. Please upload an .ics or .ical file.'
      }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({
        error: 'File too large. Maximum size is 5MB.'
      }, { status: 400 });
    }

    // Read and parse the file
    const fileContent = await file.text();

    if (!fileContent.includes('BEGIN:VCALENDAR')) {
      return NextResponse.json({
        error: 'Invalid calendar file format.'
      }, { status: 400 });
    }

    const events = parseICSFile(fileContent);

    if (events.length === 0) {
      return NextResponse.json({
        error: 'No valid events found in the calendar file.'
      }, { status: 400 });
    }

    // Store parsed events in the database
    const eventsToInsert = events.map(event => ({
      user_id: user.id,
      external_id: event.uid,
      source: 'uploaded_calendar',
      title: event.summary,
      description: event.description || null,
      start_time: event.start.dateTime || null,
      start_date: event.start.date || null,
      end_time: event.end.dateTime || null,
      end_date: event.end.date || null,
      timezone: event.start.timeZone || null,
      location: event.location || null,
      all_day: !!event.start.date,
      rrule: event.rrule || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Check if calendar_events table exists
    const { error: tableCheckError } = await supabase
      .from('calendar_events')
      .select('id')
      .limit(1);

    if (tableCheckError && tableCheckError.code === '42P01') {
      console.error('Calendar events table does not exist');
      return NextResponse.json({
        error: 'Calendar events table does not exist. Please run the database migration first.',
        details: 'You need to create the calendar_events table in your Supabase database. Please contact your administrator or run the migration script.',
        migrationNeeded: true
      }, { status: 500 });
    } else if (tableCheckError) {
      console.error('Error checking calendar_events table:', tableCheckError);
      return NextResponse.json({
        error: `Database error: ${tableCheckError.message}`,
        details: tableCheckError
      }, { status: 500 });
    }

    console.log(`Processing ${events.length} events for user ${user.id}`);

    // Insert events in batches to avoid timeout
    const batchSize = 50;
    let insertedCount = 0;

    for (let i = 0; i < eventsToInsert.length; i += batchSize) {
      const batch = eventsToInsert.slice(i, i + batchSize);

      const { error: insertError } = await supabase
        .from('calendar_events')
        .upsert(batch, {
          onConflict: 'user_id,external_id,source',
          ignoreDuplicates: false
        });

      if (insertError) {
        console.error('Error inserting batch:', insertError);
        return NextResponse.json({
          error: `Failed to save events (batch ${Math.floor(i / batchSize) + 1}): ${insertError.message}`,
          details: insertError,
          partialSuccess: insertedCount > 0
        }, { status: 500 });
      }

      insertedCount += batch.length;
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}, total: ${insertedCount}`);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${insertedCount} events`,
      totalEvents: events.length,
      importedEvents: insertedCount
    });

  } catch (error) {
    console.error('Calendar upload error:', error);
    return NextResponse.json({
      error: 'Failed to process calendar file',
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

    // Get uploaded calendar events for the user
    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('source', 'uploaded_calendar')
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching calendar events:', error);
      return NextResponse.json({
        error: 'Failed to fetch calendar events'
      }, { status: 500 });
    }

    return NextResponse.json({ events: events || [] });

  } catch (error) {
    console.error('Calendar fetch error:', error);
    return NextResponse.json({
      error: 'Failed to fetch calendar events'
    }, { status: 500 });
  }
}