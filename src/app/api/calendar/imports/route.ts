import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('calendar_imports')
      .select('id, name, file_name, event_count, created_at, updated_at, default_bucket, default_assignee')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load calendar imports', error);
      return NextResponse.json({ error: 'Failed to load uploaded calendars' }, { status: 500 });
    }

    const res = NextResponse.json({ imports: Array.isArray(data) ? data : [] });
    res.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
    return res;
  } catch (error) {
    console.error('GET /api/calendar/imports error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const body = await request.json().catch(() => ({}));
    const importId = typeof body.importId === 'string' ? body.importId : null;

    if (!importId) {
      return NextResponse.json({ error: 'importId required' }, { status: 400 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: importRow, error: fetchImportError } = await supabase
      .from('calendar_imports')
      .select('id')
      .eq('id', importId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchImportError) {
      console.error('Failed to look up calendar import', fetchImportError);
      return NextResponse.json({ error: 'Failed to load calendar import' }, { status: 500 });
    }

    if (!importRow) {
      return NextResponse.json({ error: 'Calendar import not found' }, { status: 404 });
    }

    const { data: eventRows, error: eventsError } = await supabase
      .from('calendar_events')
      .select('id, task_id')
      .eq('user_id', user.id)
      .eq('import_id', importId);

    if (eventsError) {
      console.error('Failed to load calendar events for deletion', eventsError);
      return NextResponse.json({ error: 'Failed to load calendar events' }, { status: 500 });
    }

    const taskIds = (eventRows ?? [])
      .map(row => row.task_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    let deletedTasks = 0;
    if (taskIds.length > 0) {
      const { data: removedTasks, error: deleteTasksError } = await supabase
        .from('lifeboard_tasks')
        .delete()
        .eq('user_id', user.id)
        .in('id', taskIds)
        .select('id');

      if (deleteTasksError) {
        console.error('Failed to delete tasks for calendar import', deleteTasksError);
        return NextResponse.json({ error: 'Failed to delete linked tasks' }, { status: 500 });
      }

      deletedTasks = Array.isArray(removedTasks) ? removedTasks.length : 0;
    }

    const { data: deletedEvents, error: deleteEventsError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('user_id', user.id)
      .eq('import_id', importId)
      .select('id');

    if (deleteEventsError) {
      console.error('Failed to delete calendar events for import', deleteEventsError);
      return NextResponse.json({ error: 'Failed to delete calendar events' }, { status: 500 });
    }

    const { error: deleteImportError } = await supabase
      .from('calendar_imports')
      .delete()
      .eq('id', importId)
      .eq('user_id', user.id);

    if (deleteImportError) {
      console.error('Failed to delete calendar import record', deleteImportError);
      return NextResponse.json({ error: 'Failed to delete uploaded calendar' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      deletedEvents: Array.isArray(deletedEvents) ? deletedEvents.length : 0,
      deletedTasks,
    });
  } catch (error) {
    console.error('DELETE /api/calendar/imports error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const body = await request.json().catch(() => ({}));
    const importId = typeof body.importId === 'string' ? body.importId : null;
    const rawBucket = typeof body.bucket === 'string' ? body.bucket.trim() : null;
    const normalizedBucket = rawBucket && rawBucket.length > 0 ? rawBucket : null;
    const hasAssigneeField = 'assigneeId' in body;
    const rawAssignee = typeof body.assigneeId === 'string' ? body.assigneeId.trim() : null;
    const normalizedAssignee = rawAssignee && rawAssignee.length > 0 ? rawAssignee : null;

    if (!importId) {
      return NextResponse.json({ error: 'importId required' }, { status: 400 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: importRow, error: fetchImportError } = await supabase
      .from('calendar_imports')
      .select('id')
      .eq('id', importId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchImportError) {
      console.error('Failed to look up calendar import for update', fetchImportError);
      return NextResponse.json({ error: 'Failed to load calendar import' }, { status: 500 });
    }

    if (!importRow) {
      return NextResponse.json({ error: 'Calendar import not found' }, { status: 404 });
    }

    const { data: eventRows, error: eventsError } = await supabase
      .from('calendar_events')
      .select('id, task_id')
      .eq('user_id', user.id)
      .eq('import_id', importId);

    if (eventsError) {
      console.error('Failed to load calendar events while updating bucket', eventsError);
      return NextResponse.json({ error: 'Failed to load calendar events' }, { status: 500 });
    }

    const timestamp = new Date().toISOString();

    const importUpdate: Record<string, unknown> = {
      default_bucket: normalizedBucket,
      updated_at: timestamp,
    };
    if (hasAssigneeField) {
      importUpdate.default_assignee = normalizedAssignee;
    }

    const { error: updateImportError } = await supabase
      .from('calendar_imports')
      .update(importUpdate)
      .eq('id', importId)
      .eq('user_id', user.id);

    if (updateImportError) {
      console.error('Failed to update calendar import record', updateImportError);
      return NextResponse.json({ error: 'Failed to update calendar import' }, { status: 500 });
    }

    const { error: updateEventsError } = await supabase
      .from('calendar_events')
      .update({
        bucket: normalizedBucket,
        updated_at: timestamp,
      })
      .eq('user_id', user.id)
      .eq('import_id', importId);

    if (updateEventsError) {
      console.error('Failed to update calendar events bucket', updateEventsError);
      return NextResponse.json({ error: 'Failed to update calendar events' }, { status: 500 });
    }

    const taskIds = (eventRows ?? [])
      .map((row) => row?.task_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    if (taskIds.length > 0) {
      const taskUpdate: Record<string, unknown> = {
        bucket: normalizedBucket,
        updated_at: timestamp,
      };
      if (hasAssigneeField) {
        taskUpdate.assignee_id = normalizedAssignee;
      }

      const { error: updateTasksError } = await supabase
        .from('lifeboard_tasks')
        .update(taskUpdate)
        .eq('user_id', user.id)
        .in('id', taskIds);

      if (updateTasksError) {
        console.error('Failed to update tasks after calendar import change', updateTasksError);
        return NextResponse.json({ error: 'Failed to update linked tasks' }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, bucket: normalizedBucket, assigneeId: hasAssigneeField ? normalizedAssignee : undefined });
  } catch (error) {
    console.error('PATCH /api/calendar/imports error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
