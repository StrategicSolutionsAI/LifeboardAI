// app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createTaskSchema, updateTaskSchema } from '@/lib/validations';
import { TASK_SELECT_COLUMNS as SELECT_COLUMNS, mapRowToTask } from '@/repositories/tasks';
import { withAuth, withAuthAndBody } from '@/lib/api-utils';

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

export const GET = withAuth(async (req, { supabase, user }) => {
  const sp = req.nextUrl.searchParams;
  const date = sp.get('date'); // YYYY-MM-DD
  const allParam = sp.get('all'); // truthy to load all (not date-scoped)
  const includeCompleted = sp.get('includeCompleted'); // show completed too

  if (!date && !allParam) {
    return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 });
  }

  let query = supabase
    .from('lifeboard_tasks')
    .select(SELECT_COLUMNS)
    .eq('user_id', user.id);

  if (date && !allParam) {
    // Include tasks where EITHER due_date OR start_date matches the requested day
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
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });

  return NextResponse.json({ tasks }, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
}, 'GET /api/tasks');

export const POST = withAuthAndBody(createTaskSchema, async (req, { supabase, user, body }) => {
  const content = body.content;

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
}, 'POST /api/tasks');

export const PATCH = withAuthAndBody(updateTaskSchema, async (req, { supabase, user, body }) => {
  const { id } = body;

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
}, 'PATCH /api/tasks');
