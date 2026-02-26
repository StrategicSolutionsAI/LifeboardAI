import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import { invalidateTodoistTaskCache } from '@/lib/todoist-task-cache';

const TODOIST_TASK_URL = 'https://api.todoist.com/api/v1/tasks';

export async function POST(request: NextRequest) {
  try {
    const { taskId, dueDate } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: integration } = await supabase
      .from('user_integrations')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provider', 'todoist')
      .single();

    if (!integration || !integration.access_token) {
      return NextResponse.json({ error: 'Todoist not connected' }, { status: 400 });
    }

    const body: Record<string, string> = {};
    if (dueDate === null) {
      body.due_string = 'no date';
    } else if (typeof dueDate === 'string') {
      body.due_date = dueDate; // YYYY-MM-DD
    }

    const res = await fetch(`${TODOIST_TASK_URL}/${taskId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Todoist update response', text);
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    invalidateTodoistTaskCache(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Update task error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 
