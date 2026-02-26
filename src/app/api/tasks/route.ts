// app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import { supabaseFromBearer } from '@/utils/supabase/bearer';
import { handleApiError } from '@/lib/api-error-handler';
import { createTaskSchema, updateTaskSchema, parseBody } from '@/lib/validations';

const SELECT_COLUMNS =
  'id, user_id, content, completed, due_date, start_date, end_date, hour_slot, end_hour_slot, bucket, position, duration, repeat_rule, all_day, kanban_status, created_at, updated_at';

// DB → client
function mapRowToTask(row: any) {
  const startDate: string | undefined = row.start_date ?? row.due_date ?? undefined;
  const endDate: string | undefined = row.end_date ?? startDate ?? undefined;
  return {
    id: row.id,
    content: row.content,
    completed: row.completed,
    due: startDate ? { date: startDate } : undefined,
    startDate,
    endDate,
    hourSlot: row.hour_slot || undefined,
    endHourSlot: row.end_hour_slot || undefined,
    bucket: row.bucket || undefined,
    position: row.position ?? undefined,
    duration: row.duration ?? undefined,
    repeatRule: row.repeat_rule || undefined,
    allDay: row.all_day ?? (row.hour_slot ? false : true),
    kanbanStatus: row.kanban_status ?? (row.completed ? 'done' : 'todo'),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// hour_slot normalizer (supports number 0–23 or display strings)
function normalizeHourSlot(value?: number | string): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const h = Math.max(0, Math.min(23, value));
    const display =
      h === 0 ? '12AM' : h < 12 ? `${h}AM` : h === 12 ? '12PM' : `${h - 12}PM`;
    return `hour-${display}`;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.startsWith('hour-') ? value : `hour-${value.trim()}`;
  }
  return undefined;
}

function getClientFromRequest(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    return supabaseFromBearer(token);
  }
  return supabaseServer(); // cookie-based (browser)
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const date = sp.get('date'); // YYYY-MM-DD
    const allParam = sp.get('all'); // truthy to load all (not date-scoped)
    const includeCompleted = sp.get('includeCompleted'); // show completed too

    if (!date && !allParam) {
      return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 });
    }

    const supabase = getClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let query = supabase
      .from('lifeboard_tasks')
      .select(SELECT_COLUMNS)
      .eq('user_id', user.id);

    if (date && !allParam) {
      // ✅ Include tasks where EITHER due_date OR start_date matches the requested day
      query = query.or(`due_date.eq.${date},start_date.eq.${date}`);
    }

    // Hide completed unless explicitly requested
    if (!includeCompleted) {
      query = query.eq('completed', false);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Supabase select lifeboard_tasks error', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const tasks = (data || [])
      .map(mapRowToTask)
      .sort((a, b) => {
        const pa = a.position ?? Number.MAX_SAFE_INTEGER;
        const pb = b.position ?? Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    return NextResponse.json({ tasks });
  } catch (e) {
    return handleApiError(e, 'GET /api/tasks');
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = parseBody(createTaskSchema, rawBody);
    if (parsed.response) return parsed.response;
    const body = parsed.data;

    const content = body.content;

    const supabase = getClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const hourSlot = normalizeHourSlot(body.hour_slot ?? body.hourSlot ?? undefined);
    const endHourSlot = normalizeHourSlot(body.end_hour_slot ?? body.endHourSlot ?? undefined);

    const start_date = (body.start_date ?? body.due_date) ?? null;
    const end_date = (body.end_date ?? start_date) ?? null;

    const insert = {
      user_id: user.id,
      content,
      completed: false,
      due_date: start_date,
      start_date,
      end_date,
      hour_slot: hourSlot || null,
      end_hour_slot: endHourSlot || null,
      bucket: (body.bucket as string | undefined) ?? null,
      duration: typeof body.duration === 'number' ? body.duration : null,
      position: typeof body.position === 'number' ? body.position : null,
      all_day:
        typeof body.all_day === 'boolean'
          ? body.all_day
          : typeof body.allDay === 'boolean'
          ? body.allDay
          : !hourSlot && !endHourSlot,
      repeat_rule: (body.repeat_rule as string | undefined) ?? (body.repeatRule as string | undefined) ?? null,
    };

    const { data, error } = await supabase
      .from('lifeboard_tasks')
      .insert(insert)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      console.error('Supabase insert lifeboard_tasks error', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ task: mapRowToTask(data) }, { status: 201 });
  } catch (e) {
    return handleApiError(e, 'POST /api/tasks');
  }
}

// Minimal PATCH: toggle completion
export async function PATCH(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parsed = parseBody(updateTaskSchema, rawBody);
    if (parsed.response) return parsed.response;
    const body = parsed.data;
    const { id } = body;

    const supabase = getClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const updatePayload: Record<string, any> = {};

    if (typeof body.completed === 'boolean') {
      updatePayload.completed = body.completed;
    }

    if (typeof body.content === 'string' && body.content.trim().length > 0) {
      updatePayload.content = body.content.trim();
    }

    if (body.bucket !== undefined) {
      updatePayload.bucket = body.bucket ? String(body.bucket).trim() : null;
    }

    const dueDate = body.due_date ?? body.dueDate;
    if (dueDate !== undefined) {
      updatePayload.due_date = dueDate ? String(dueDate).trim() : null;
    }

    const startDate = body.start_date ?? body.startDate;
    if (startDate !== undefined) {
      updatePayload.start_date = startDate ? String(startDate).trim() : null;
    }

    const endDate = body.end_date ?? body.endDate;
    if (endDate !== undefined) {
      updatePayload.end_date = endDate ? String(endDate).trim() : null;
    }

    if (body.hour_slot !== undefined || body.hourSlot !== undefined) {
      const normalized = normalizeHourSlot(body.hour_slot ?? body.hourSlot ?? undefined);
      updatePayload.hour_slot = normalized ?? null;
    }

    if (body.end_hour_slot !== undefined || body.endHourSlot !== undefined) {
      const normalizedEnd = normalizeHourSlot(body.end_hour_slot ?? body.endHourSlot ?? undefined);
      updatePayload.end_hour_slot = normalizedEnd ?? null;
    }

    const allDay = body.all_day ?? body.allDay;
    if (typeof allDay === 'boolean') {
      updatePayload.all_day = allDay;
    }

    const duration = body.duration;
    if (duration !== undefined) {
      updatePayload.duration = typeof duration === 'number' && Number.isFinite(duration) ? duration : null;
    }

    const repeatRule = body.repeat_rule ?? body.repeatRule;
    if (repeatRule !== undefined) {
      updatePayload.repeat_rule = repeatRule ? String(repeatRule).trim() : null;
    }

    const kanbanStatus = (body as any).kanban_status ?? (body as any).kanbanStatus;
    if (typeof kanbanStatus === 'string' && ['todo', 'in_progress', 'done'].includes(kanbanStatus)) {
      updatePayload.kanban_status = kanbanStatus;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'no update fields provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lifeboard_tasks')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      console.error('Supabase update lifeboard_tasks error', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ task: mapRowToTask(data) });
  } catch (e) {
    return handleApiError(e, 'PATCH /api/tasks');
  }
}
