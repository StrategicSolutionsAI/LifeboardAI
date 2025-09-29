import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';

interface TaskOccurrenceExceptionRow {
  id: string;
  task_id: string;
  occurrence_date: string;
  skip: boolean;
  override_hour_slot: string | null;
  override_duration: number | null;
  override_bucket: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: TaskOccurrenceExceptionRow) {
  return {
    id: row.id,
    taskId: row.task_id,
    occurrenceDate: row.occurrence_date,
    skip: row.skip,
    overrideHourSlot: row.override_hour_slot,
    overrideDuration: row.override_duration,
    overrideBucket: row.override_bucket,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('task_occurrence_exceptions')
      .select('*')
      .eq('user_id', user.id)
      .order('occurrence_date', { ascending: true });

    if (error) {
      console.error('Failed to load task occurrence exceptions', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      exceptions: (data || []).map(mapRow),
    });
  } catch (error) {
    console.error('GET /api/task-occurrence-exceptions error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const taskId = typeof body.taskId === 'string' ? body.taskId : undefined;
    const occurrenceDate = typeof body.occurrenceDate === 'string' ? body.occurrenceDate : undefined;
    const skip = body.skip === true;
    const overrideHourSlot = body.overrideHourSlot ?? null;
    const overrideDuration = typeof body.overrideDuration === 'number' ? body.overrideDuration : body.overrideDuration === null ? null : undefined;
    const overrideBucket = typeof body.overrideBucket === 'string' ? body.overrideBucket : body.overrideBucket === null ? null : undefined;

    if (!taskId || !occurrenceDate) {
      return NextResponse.json({ error: 'taskId and occurrenceDate required' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload: Record<string, any> = {
      user_id: user.id,
      task_id: taskId,
      occurrence_date: occurrenceDate,
      skip,
      override_hour_slot: overrideHourSlot,
      override_bucket: overrideBucket,
    };

    if (overrideDuration !== undefined) {
      payload.override_duration = overrideDuration;
    }

    const { data, error } = await supabase
      .from('task_occurrence_exceptions')
      .upsert(payload, { onConflict: 'user_id,task_id,occurrence_date' })
      .select('*')
      .single();

    if (error) {
      console.error('Failed to upsert task occurrence exception', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ exception: mapRow(data) });
  } catch (error) {
    console.error('POST /api/task-occurrence-exceptions error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const taskId = typeof body.taskId === 'string' ? body.taskId : undefined;
    const occurrenceDate = typeof body.occurrenceDate === 'string' ? body.occurrenceDate : undefined;

    if (!taskId || !occurrenceDate) {
      return NextResponse.json({ error: 'taskId and occurrenceDate required' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { error } = await supabase
      .from('task_occurrence_exceptions')
      .delete()
      .eq('user_id', user.id)
      .eq('task_id', taskId)
      .eq('occurrence_date', occurrenceDate);

    if (error) {
      console.error('Failed to delete task occurrence exception', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/task-occurrence-exceptions error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
