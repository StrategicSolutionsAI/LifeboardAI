import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';

const TODOIST_TASKS_ENDPOINT = 'https://api.todoist.com/rest/v2/tasks';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date'); // YYYY-MM-DD
    if (!date) {
      return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get Todoist access token
    const { data: integration, error } = await supabase
      .from('user_integrations')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provider', 'todoist')
      .maybeSingle();

    if (error) {
      console.error('Supabase error fetching todoist integration', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!integration?.access_token) {
      return NextResponse.json({ error: 'Todoist not connected' }, { status: 400 });
    }

    // Call Todoist REST API – fetch all open tasks then filter client-side
    const url = `${TODOIST_TASKS_ENDPOINT}`;

    const todoistRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
      },
    });

    if (!todoistRes.ok) {
      const text = await todoistRes.text();
      console.error('Todoist API error', todoistRes.status, text);
      return NextResponse.json({ error: 'Todoist API error', status: todoistRes.status }, { status: 502 });
    }

    const tasks = await todoistRes.json();

    // Include tasks that are due today or overdue
    const filtered = tasks.filter((t: any) => {
      if (!t.due?.date) return false;
      return t.due.date <= date; // string compare works for YYYY-MM-DD
    });

    return NextResponse.json({ tasks: filtered });
  } catch (err) {
    console.error('Todoist tasks endpoint error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 