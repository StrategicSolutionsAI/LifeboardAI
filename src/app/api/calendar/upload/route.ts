import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import { SESSION_EXPIRED_HEADER } from '@/lib/session-expired';
import { getDataScope, ownedOrShared } from '@/lib/household/scope';
import { syncEventsToTasks, type CalendarEventRow } from '@/lib/calendar-sync';
import { icsEventsToRows, parseICSFile } from '@/lib/calendar/ics';
import { CalendarImportWriteError, writeImportEvents, type ImportWriteResult } from '@/lib/calendar/ics-import';

async function cleanupPartialCalendarImport(
  supabase: ReturnType<typeof supabaseServer>,
  importId: string | null,
) {
  if (!importId) return;
  const { error } = await supabase.rpc('delete_calendar_import', {
    p_import_id: importId,
  });
  if (error) {
    console.error('Failed to roll back partial calendar import', error);
  }
}

export async function POST(request: NextRequest) {
  let importId: string | null = null;
  let currentUserId: string | null = null;
  try {
    const supabase = supabaseServer();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { [SESSION_EXPIRED_HEADER]: '1' } });
    }
    currentUserId = user.id;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const rawCalendarName = (formData.get('calendarName') as string | null)?.trim();
    const rawBucket = (formData.get('bucket') as string | null)?.trim();
    const selectedBucket = rawBucket && rawBucket.length > 0 ? rawBucket : null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file extension
    if (!file.name.endsWith('.ics') && !file.name.endsWith('.ical')) {
      return NextResponse.json({
        error: 'Invalid file type. Please upload an .ics or .ical file.'
      }, { status: 400 });
    }

    // Validate MIME type (browsers may send various types for .ics)
    const ALLOWED_MIME_TYPES = new Set([
      'text/calendar', 'application/ics', 'text/x-vcalendar',
      'application/octet-stream', '',
    ]);
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({
        error: `Unexpected file type "${file.type}". Please upload a valid .ics calendar file.`
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

    // Validate content starts with iCalendar header (content-based check)
    if (!fileContent.includes('BEGIN:VCALENDAR')) {
      return NextResponse.json({
        error: 'Invalid calendar file format. File does not contain valid iCalendar data.'
      }, { status: 400 });
    }

    const events = parseICSFile(fileContent);

    if (events.length === 0) {
      return NextResponse.json({
        error: 'No valid events found in the calendar file.'
      }, { status: 400 });
    }

    const calendarName = rawCalendarName && rawCalendarName.length > 0
      ? rawCalendarName
      : (file.name.replace(/\.(ics|ical)$/i, '') || 'Imported Calendar');

    try {
      const { data: importRow, error: importError } = await supabase
        .from('calendar_imports')
        .insert({
          user_id: user.id,
          name: calendarName,
          file_name: file.name,
          default_bucket: selectedBucket,
        })
        .select('id')
        .single();

      if (importError || !importRow) {
        throw importError ?? new Error('Missing calendar import record');
      }

      importId = importRow.id;
    } catch (importError) {
      console.error('Failed to create calendar import record', importError);
      return NextResponse.json({
        error: 'Failed to prepare calendar import. Please try again.'
      }, { status: 500 });
    }

    // Store parsed events in the database
    const eventsToInsert = icsEventsToRows(events, { userId: user.id, importId: importId!, bucket: selectedBucket });

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

    let written: ImportWriteResult;
    try {
      written = await writeImportEvents(supabase, user.id, importId!, eventsToInsert);
    } catch (writeError) {
      if (!(writeError instanceof CalendarImportWriteError)) throw writeError;
      await cleanupPartialCalendarImport(supabase, importId);
      return NextResponse.json(writeError.body, { status: 500 });
    }
    const { insertedCount, tasksCreated, tasksUpdated, tasksErrored, insertionWarnings } = written;

    const responsePayload: Record<string, unknown> = {
      success: true,
      message: `Successfully imported ${insertedCount} events`,
      totalEvents: events.length,
      importedEvents: insertedCount,
      tasksCreated,
      tasksUpdated,
      taskSyncErrors: tasksErrored,
      importId,
      calendarName,
    };

    if (selectedBucket) {
      responsePayload.bucket = selectedBucket;
    }

    if (tasksErrored > 0) {
      responsePayload.warnings = 'Some events were saved but could not be converted into tasks. Check server logs for details.';
    }

    if (insertionWarnings.length > 0) {
      responsePayload.warnings = responsePayload.warnings
        ? `${responsePayload.warnings} ${insertionWarnings.join(' ')}`
        : insertionWarnings.join(' ');
    }

    if (importId) {
      try {
        await supabase
          .from('calendar_imports')
          .update({
            event_count: insertedCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', importId)
          .eq('user_id', user.id);
      } catch (updateImportError) {
        console.error('Failed to update calendar import metadata', updateImportError);
      }
    }

    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error('Calendar upload error:', error);
    if (importId && currentUserId) {
      try {
        const supabase = supabaseServer();
        await cleanupPartialCalendarImport(supabase, importId);
      } catch (cleanupError) {
        console.error('Failed to clean up partial calendar import', cleanupError);
      }
    }
    return NextResponse.json({
      error: 'Failed to process calendar file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Rows the calendar view renders: ICS imports plus events the assistant adds
// through POST /api/calendar/events (which defaults source to 'manual').
const CALENDAR_VIEW_SOURCES = ['uploaded_calendar', 'manual'];

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { [SESSION_EXPIRED_HEADER]: '1' } });
    }

    // Calendar events visible to the user: their own and their household's
    const scope = await getDataScope(supabase, user.id);
    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('*')
      .or(ownedOrShared(scope))
      .in('source', CALENDAR_VIEW_SOURCES)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching calendar events:', error);
      return NextResponse.json({
        error: 'Failed to fetch calendar events'
      }, { status: 500 });
    }

    let normalizedEvents = (events ?? []) as CalendarEventRow[];

    // Only the author backfills a linked task: the sync writes the task as the
    // current user and links it back by their user id.
    const eventsMissingTask = normalizedEvents.filter((event) => !event.task_id && event.user_id === user.id);

    if (eventsMissingTask.length > 0) {
      try {
        await syncEventsToTasks(supabase, user.id, eventsMissingTask);
        const { data: refreshedEvents, error: refreshError } = await supabase
          .from('calendar_events')
          .select('*')
          .or(ownedOrShared(scope))
          .in('source', CALENDAR_VIEW_SOURCES)
          .order('start_time', { ascending: true });

        if (!refreshError && Array.isArray(refreshedEvents)) {
          normalizedEvents = refreshedEvents as CalendarEventRow[];
        }
      } catch (syncError) {
        console.error('Failed to backfill missing calendar task links', syncError);
      }
    }

    // Attach default_assignee from calendar_imports so the client can color events
    const { data: importRows } = await supabase
      .from('calendar_imports')
      .select('id, default_assignee')
      .or(ownedOrShared(scope));

    const assigneeByImport = new Map<string, string>();
    if (Array.isArray(importRows)) {
      for (const row of importRows) {
        if (row.default_assignee) {
          assigneeByImport.set(row.id, row.default_assignee);
        }
      }
    }

    const eventsWithAssignee = normalizedEvents.map((ev) => {
      const importAssignee = ev.import_id ? assigneeByImport.get(ev.import_id) : undefined;
      return importAssignee ? { ...ev, default_assignee: importAssignee } : ev;
    });

    return NextResponse.json({ events: eventsWithAssignee });

  } catch (error) {
    console.error('Calendar fetch error:', error);
    return NextResponse.json({
      error: 'Failed to fetch calendar events'
    }, { status: 500 });
  }
}
