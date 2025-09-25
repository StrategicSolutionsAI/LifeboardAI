import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import {
  calculateDurationMinutes,
  isoToHourSlot,
  mapRruleToRepeatRule,
  IMPORTED_CALENDAR_BUCKET,
  type CalendarRepeatRule,
} from '@/lib/calendar-sync';

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

function formatDateTime(raw: string): string {
  const normalized = raw.trim();

  // Match YYYYMMDDT followed by a variable length time (2-6 digits) with optional Z
  const match = normalized.match(/^(\d{8})T(\d{1,6})(Z)?$/i);
  if (!match) {
    return normalized;
  }

  const [, datePart, timePart, zFlag] = match;
  const year = datePart.substring(0, 4);
  const month = datePart.substring(4, 6);
  const day = datePart.substring(6, 8);

  // Pad the time section to HHMMSS
  const paddedTime = timePart.padEnd(6, '0').slice(0, 6);
  const hour = paddedTime.substring(0, 2);
  const minute = paddedTime.substring(2, 4);
  const second = paddedTime.substring(4, 6);
  const suffix = zFlag ? 'Z' : '';

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${suffix}`;
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

type ServerSupabaseClient = ReturnType<typeof supabaseServer>;

type RepeatRule = CalendarRepeatRule;

interface CalendarEventRow {
  id: string;
  title: string | null;
  start_time: string | null;
  start_date: string | null;
  end_time: string | null;
  end_date: string | null;
  all_day: boolean | null;
  rrule: string | null;
  task_id: string | null;
}

class MissingTasksTableError extends Error {
  constructor() {
    super('lifeboard_tasks table missing');
    this.name = 'MissingTasksTableError';
  }
}

async function syncEventsToTasks(
  supabase: ServerSupabaseClient,
  userId: string,
  events: CalendarEventRow[]
): Promise<{ created: number; updated: number; errors: number; }> {
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const event of events) {
    const title = (event.title ?? '').trim();
    if (!title) {
      continue;
    }

    const dueDate = event.start_date || (event.start_time ? event.start_time.slice(0, 10) : null);
    const hourSlot = isoToHourSlot(event.start_time);
    const duration = calculateDurationMinutes(event.start_time, event.end_time);
    const repeatRule = mapRruleToRepeatRule(event.rrule);

    if (!event.task_id) {
      const { data: taskData, error: taskError } = await supabase
        .from('lifeboard_tasks')
        .insert([{
          user_id: userId,
          content: title,
          completed: false,
          due_date: dueDate,
          hour_slot: hourSlot ?? null,
          bucket: IMPORTED_CALENDAR_BUCKET,
          duration: duration ?? null,
          repeat_rule: repeatRule ?? null,
        }])
        .select('id')
        .single();

      if (taskError) {
        if (taskError.code === '42P01') {
          throw new MissingTasksTableError();
        }
        errors++;
        console.error('Failed to create task for calendar event', { eventId: event.id, taskError });
        continue;
      }

      const newTaskId = taskData?.id;
      if (!newTaskId) {
        errors++;
        console.error('Task creation response missing id', { eventId: event.id });
        continue;
      }

      const { error: linkError } = await supabase
        .from('calendar_events')
        .update({ task_id: newTaskId, updated_at: new Date().toISOString() })
        .eq('id', event.id);

      if (linkError) {
        if (linkError.code === '42P01') {
          throw new MissingTasksTableError();
        }
        errors++;
        console.error('Failed to link task to calendar event', { eventId: event.id, linkError });
        continue;
      }

      event.task_id = newTaskId;
      created++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('lifeboard_tasks')
      .update({
        content: title,
        due_date: dueDate,
        hour_slot: hourSlot ?? null,
        duration: duration ?? null,
        repeat_rule: repeatRule ?? null,
      })
      .eq('id', event.task_id)
      .eq('user_id', userId);

    if (updateError) {
      if (updateError.code === '42P01') {
        throw new MissingTasksTableError();
      }
      errors++;
      console.error('Failed to update task from calendar event', { eventId: event.id, taskId: event.task_id, updateError });
      continue;
    }

    updated++;
  }

  return { created, updated, errors };
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
    const eventsToInsert = events.reduce<Array<Record<string, any>>>((acc, event) => {
      const start = event.start ?? {};
      const end = event.end ?? {};

      const startTime = start.dateTime || null;
      const startDate = start.date || (startTime ? startTime.slice(0, 10) : null);

      if (!startDate && !startTime) {
        console.warn('Skipping calendar event without start date/time', { uid: event.uid });
        return acc;
      }

      acc.push({
        user_id: user.id,
        external_id: event.uid,
        source: 'uploaded_calendar',
        title: event.summary,
        description: event.description || null,
        start_time: startTime,
        start_date: startDate,
        end_time: end.dateTime || null,
        end_date: end.date || null,
        timezone: start.timeZone || null,
        location: event.location || null,
        all_day: Boolean(start.date),
        rrule: event.rrule || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return acc;
    }, []);

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
    let tasksCreated = 0;
    let tasksUpdated = 0;
    let tasksErrored = 0;

    const insertionWarnings: string[] = [];

    for (let i = 0; i < eventsToInsert.length; i += batchSize) {
      const batch = eventsToInsert.slice(i, i + batchSize);

      let batchWithTaskIds = batch;
      const externalIds = batch.map((event) => event.external_id).filter(Boolean);

      if (externalIds.length > 0) {
        const { data: existingRows, error: existingError } = await supabase
          .from('calendar_events')
          .select('external_id, task_id')
          .eq('user_id', user.id)
          .eq('source', 'uploaded_calendar')
          .in('external_id', externalIds);

        if (existingError) {
          console.error('Error loading existing calendar events for task preservation:', existingError);
          return NextResponse.json({
            error: 'Failed to look up existing calendar events while importing.',
            details: existingError.message,
          }, { status: 500 });
        }

        const taskIdMap = new Map<string, string>();
        existingRows?.forEach((row: { external_id: string; task_id: string | null }) => {
          if (row.external_id && row.task_id) {
            taskIdMap.set(row.external_id, row.task_id);
          }
        });

        batchWithTaskIds = batch.map((event) => ({
          ...event,
          task_id: taskIdMap.get(event.external_id) ?? null,
        }));
      }

      const { data: upsertedRows, error: insertError } = await supabase
        .from('calendar_events')
        .upsert(batchWithTaskIds, {
          onConflict: 'user_id,external_id,source',
          ignoreDuplicates: false
        })
        .select('id, title, start_time, start_date, end_time, end_date, all_day, rrule, task_id');

      let rowsToProcess: CalendarEventRow[] = Array.isArray(upsertedRows) ? upsertedRows as CalendarEventRow[] : [];

      if (insertError) {
        console.error('Error inserting batch, falling back to individual inserts:', insertError);
        // Attempt to salvage by inserting rows one-by-one so one bad event does not kill the entire import.
        const recoveredRows: CalendarEventRow[] = [];
        for (const event of batchWithTaskIds) {
          const { data, error } = await supabase
            .from('calendar_events')
            .upsert(event, {
              onConflict: 'user_id,external_id,source',
              ignoreDuplicates: false
            })
            .select('id, title, start_time, start_date, end_time, end_date, all_day, rrule, task_id')
            .single();

          if (error) {
            console.error('Failed to save individual calendar event, skipping:', { externalId: event.external_id, error });
            insertionWarnings.push(`Skipped event ${event.title || event.external_id}: ${error.message}`);
            continue;
          }

          if (data) {
            recoveredRows.push(data as CalendarEventRow);
          }
        }

        if (recoveredRows.length === 0 && insertedCount === 0) {
          return NextResponse.json({
            error: `Failed to save events (batch ${Math.floor(i / batchSize) + 1}): ${insertError.message}`,
            details: insertError,
            partialSuccess: false
          }, { status: 500 });
        }

        rowsToProcess = recoveredRows;
      }

      const processedCount = rowsToProcess.length;
      insertedCount += processedCount;

      if (rowsToProcess.length > 0) {
        try {
          const syncResult = await syncEventsToTasks(supabase, user.id, rowsToProcess);
          tasksCreated += syncResult.created;
          tasksUpdated += syncResult.updated;
          tasksErrored += syncResult.errors;
        } catch (syncError) {
          if (syncError instanceof MissingTasksTableError) {
            return NextResponse.json({
              error: 'Tasks table not found in Supabase',
              details: 'Calendar events were saved but Lifeboard tasks table is missing. Please run supabase/migrations/0001_create_lifeboard_tasks.sql and retry.',
              partialSuccess: true,
              importedEvents: insertedCount
            }, { status: 500 });
          }

          console.error('Error syncing calendar events to tasks:', syncError);
          return NextResponse.json({
            error: 'Failed to convert calendar events into tasks',
            details: syncError instanceof Error ? syncError.message : 'Unknown error',
            partialSuccess: true,
            importedEvents: insertedCount
          }, { status: 500 });
        }
      }

      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}, events so far: ${insertedCount}`);
    }

    const responsePayload: Record<string, unknown> = {
      success: true,
      message: `Successfully imported ${insertedCount} events`,
      totalEvents: events.length,
      importedEvents: insertedCount,
      tasksCreated,
      tasksUpdated,
      taskSyncErrors: tasksErrored,
    };

    if (tasksErrored > 0) {
      responsePayload.warnings = 'Some events were saved but could not be converted into tasks. Check server logs for details.';
    }

    if (insertionWarnings.length > 0) {
      responsePayload.warnings = responsePayload.warnings
        ? `${responsePayload.warnings} ${insertionWarnings.join(' ')}`
        : insertionWarnings.join(' ');
    }

    return NextResponse.json(responsePayload);

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

    let normalizedEvents = events || [];

    const eventsMissingTask = normalizedEvents
      .filter((event) => !event.task_id)
      .map((event) => ({
        id: event.id,
        title: event.title,
        start_time: event.start_time,
        start_date: event.start_date,
        end_time: event.end_time,
        end_date: event.end_date,
        all_day: event.all_day,
        rrule: event.rrule,
        task_id: event.task_id,
      }));

    if (eventsMissingTask.length > 0) {
      try {
        await syncEventsToTasks(supabase, user.id, eventsMissingTask);
        const { data: refreshedEvents, error: refreshError } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('user_id', user.id)
          .eq('source', 'uploaded_calendar')
          .order('start_time', { ascending: true });

        if (!refreshError && Array.isArray(refreshedEvents)) {
          normalizedEvents = refreshedEvents;
        }
      } catch (syncError) {
        console.error('Failed to backfill missing calendar task links', syncError);
      }
    }

    return NextResponse.json({ events: normalizedEvents });

  } catch (error) {
    console.error('Calendar fetch error:', error);
    return NextResponse.json({
      error: 'Failed to fetch calendar events'
    }, { status: 500 });
  }
}
