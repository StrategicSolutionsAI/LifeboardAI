import type { SupabaseClient } from '@supabase/supabase-js';
import {
  syncEventsToTasks,
  MissingTasksTableError,
  type CalendarEventRow,
} from '@/lib/calendar-sync';

/** A failure that leaves the import half-written; `body` is the API error payload. */
export class CalendarImportWriteError extends Error {
  constructor(public body: Record<string, unknown>) {
    super(String(body.error));
    this.name = 'CalendarImportWriteError';
  }
}

export interface ImportWriteResult {
  insertedCount: number;
  tasksCreated: number;
  tasksUpdated: number;
  tasksErrored: number;
  insertionWarnings: string[];
}

/**
 * Upserts an import's calendar_events rows in batches and links each to a
 * task, preserving existing task links on re-import. Shared by .ics uploads
 * and calendar feed refreshes; the caller rolls back on CalendarImportWriteError.
 */
export async function writeImportEvents(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  importId: string,
  rows: Array<Record<string, any>>,
): Promise<ImportWriteResult> {
  // Insert events in batches to avoid timeout
  const eventsToInsert = rows;
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
        .eq('user_id', userId)
        .eq('source', 'uploaded_calendar')
        .eq('import_id', importId)
        .in('external_id', externalIds);

      if (existingError) {
        console.error('Error loading existing calendar events for task preservation:', existingError);
        throw new CalendarImportWriteError({
          error: 'Failed to look up existing calendar events while importing.',
          details: existingError.message,
        });
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
        onConflict: 'user_id,external_id,source,import_id',
        ignoreDuplicates: false
      })
      .select('id, import_id, title, content, start_time, start_date, end_time, end_date, end_hour_slot, all_day, rrule, repeat_rule, due_date, hour_slot, bucket, duration, completed, position, task_id');

    let rowsToProcess: CalendarEventRow[] = Array.isArray(upsertedRows) ? upsertedRows as CalendarEventRow[] : [];

    if (insertError) {
      console.error('Error inserting batch, falling back to individual inserts:', insertError);
      // Attempt to salvage by inserting rows one-by-one so one bad event does not kill the entire import.
      const recoveredRows: CalendarEventRow[] = [];
      for (const event of batchWithTaskIds) {
        const { data, error } = await supabase
          .from('calendar_events')
          .upsert(event, {
            onConflict: 'user_id,external_id,source,import_id',
            ignoreDuplicates: false
          })
          .select('id, import_id, title, content, start_time, start_date, end_time, end_date, end_hour_slot, all_day, rrule, repeat_rule, due_date, hour_slot, bucket, duration, completed, position, task_id')
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
        throw new CalendarImportWriteError({
          error: `Failed to save events (batch ${Math.floor(i / batchSize) + 1}): ${insertError.message}`,
          details: insertError,
          partialSuccess: false
        });
      }

      rowsToProcess = recoveredRows;
    }

    const processedCount = rowsToProcess.length;
    insertedCount += processedCount;

    if (rowsToProcess.length > 0) {
      try {
        const syncResult = await syncEventsToTasks(supabase, userId, rowsToProcess);
        tasksCreated += syncResult.created;
        tasksUpdated += syncResult.updated;
        tasksErrored += syncResult.errors;
      } catch (syncError) {
        if (syncError instanceof MissingTasksTableError) {
          throw new CalendarImportWriteError({
            error: 'Tasks table not found in Supabase',
            details: 'Calendar events were saved but Lifeboard tasks table is missing. Please run supabase/migrations/0001_create_lifeboard_tasks.sql and retry.',
            partialSuccess: true,
            importedEvents: insertedCount
          });
        }

        console.error('Error syncing calendar events to tasks:', syncError);
        throw new CalendarImportWriteError({
          error: 'Failed to convert calendar events into tasks',
          details: syncError instanceof Error ? syncError.message : 'Unknown error',
          partialSuccess: true,
          importedEvents: insertedCount
        });
      }
    }

  }

  return { insertedCount, tasksCreated, tasksUpdated, tasksErrored, insertionWarnings };
}
