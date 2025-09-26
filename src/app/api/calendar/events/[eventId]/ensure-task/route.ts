import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import {
  syncEventsToTasks,
  MissingTasksTableError,
  type CalendarEventRow,
} from '@/lib/calendar-sync';

function normalizeRepeat(rule: unknown): string | null {
  if (typeof rule !== 'string') return null;
  const value = rule.toLowerCase();
  if (value === 'daily' || value === 'weekly' || value === 'weekdays' || value === 'monthly') {
    return value;
  }
  return null;
}

export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  const eventId = params?.eventId;
  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  }

  try {
    const supabase = supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: eventRow, error: fetchError } = await supabase
      .from('calendar_events')
      .select(
        'id, user_id, import_id, title, content, start_time, start_date, end_time, end_date, all_day, rrule, repeat_rule, due_date, hour_slot, bucket, duration, completed, position, task_id'
      )
      .eq('id', eventId)
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }
      console.error('Failed to load calendar event for ensure-task', { eventId, fetchError });
      return NextResponse.json({ error: 'Database error', details: fetchError.message }, { status: 500 });
    }

    const syncPayload: CalendarEventRow = {
      id: eventRow.id,
      import_id: eventRow.import_id ?? null,
      external_id: null,
      source: 'uploaded_calendar',
      title: eventRow.title ?? null,
      content: eventRow.content ?? eventRow.title ?? null,
      start_time: eventRow.start_time ?? null,
      start_date: eventRow.start_date ?? null,
      end_time: eventRow.end_time ?? null,
      end_date: eventRow.end_date ?? null,
      all_day: eventRow.all_day ?? null,
      rrule: eventRow.rrule ?? null,
      repeat_rule: eventRow.repeat_rule ?? null,
      due_date: eventRow.due_date ?? null,
      hour_slot: eventRow.hour_slot ?? null,
      bucket: eventRow.bucket ?? null,
      duration: eventRow.duration ?? null,
      completed: eventRow.completed ?? null,
      position: eventRow.position ?? null,
      task_id: eventRow.task_id ?? null,
    };

    try {
      await syncEventsToTasks(supabase, user.id, [syncPayload]);
    } catch (error) {
      if (error instanceof MissingTasksTableError) {
        return NextResponse.json(
          {
            error: 'Tasks table not found in Supabase',
            details: 'Run the lifeboard_tasks migration before importing calendar events.',
          },
          { status: 500 }
        );
      }
      console.error('Failed to sync calendar event to task', { eventId, error });
      return NextResponse.json({ error: 'Failed to sync calendar event' }, { status: 500 });
    }

    const { data: refreshedEvent, error: refreshError } = await supabase
      .from('calendar_events')
      .select('task_id, bucket, repeat_rule')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .single();

    if (refreshError) {
      console.error('Failed to reload calendar event after sync', { eventId, refreshError });
      return NextResponse.json({ error: 'Failed to reload calendar event' }, { status: 500 });
    }

    const taskId = refreshedEvent?.task_id ?? null;

    return NextResponse.json({
      ok: true,
      taskId,
      bucket: refreshedEvent?.bucket ?? null,
      repeatRule: normalizeRepeat(refreshedEvent?.repeat_rule),
    });
  } catch (error) {
    console.error('POST /api/calendar/events/[eventId]/ensure-task error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
