// app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createTaskSchema, updateTaskSchema } from '@/lib/validations';
import { TASK_SELECT_COLUMNS as SELECT_COLUMNS, mapRowToTask } from '@/repositories/tasks';
import { withAuth, withAuthAndBody } from '@/lib/api-utils';
import { normalizeHourSlot } from '@/lib/date-utils';

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

  // Sort in SQL: position ASC (nulls last), then created_at DESC
  query = query
    .order('position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  // Optional pagination (backwards-compatible — omit for all results)
  const limitParam = sp.get('limit');
  const offsetParam = sp.get('offset');
  if (limitParam) {
    const limit = Math.max(1, Math.min(1000, parseInt(limitParam, 10) || 100));
    const offset = Math.max(0, parseInt(offsetParam ?? '0', 10) || 0);
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Supabase select lifeboard_tasks error', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  const tasks = (data || []).map(mapRowToTask);

  // no-store: clients refetch this list ~120ms after mutations, so any HTTP
  // caching serves the pre-write response and makes new tasks vanish briefly.
  return NextResponse.json({ tasks }, { headers: { 'Cache-Control': 'no-store' } });
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
    assignee_id: (body.assignee_id as string | undefined) ?? (body.assigneeId as string | undefined) ?? null,
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

  const assigneeId = body.assignee_id ?? body.assigneeId;
  if (assigneeId !== undefined) {
    updatePayload.assignee_id = assigneeId ? String(assigneeId).trim() : null;
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
