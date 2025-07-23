import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';

const TODOIST_TASKS_ENDPOINT = 'https://api.todoist.com/rest/v2/tasks';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date'); // YYYY-MM-DD
    const allParam = searchParams.get('all');

    if (!date && !allParam) {
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

    // Parse metadata from task descriptions and enhance tasks
    const enhancedTasks = tasks.map((task: any) => {
      let metadata: { duration?: number; hourSlot?: string } = {};
      
      if (task.description) {
        try {
          const metaMatch = task.description.match(/\[LIFEBOARD_META\](.*?)\[\/LIFEBOARD_META\]/);
          if (metaMatch) {
            metadata = JSON.parse(metaMatch[1]);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      return {
        ...task,
        duration: metadata.duration, // Only include if exists
        hourSlot: metadata.hourSlot, // Only include if exists - no default
      };
    });

    let responseTasks = enhancedTasks;

    if (date && !allParam) {
      // Include tasks that are due today or overdue (tasks with no due date are excluded)
      responseTasks = enhancedTasks.filter((t: any) => {
        if (!t.due?.date) return false;
        return t.due.date === date; // strict match for the selected date
      });
    }

    // For all=true we return all open tasks (no filtering)
    return NextResponse.json({ tasks: responseTasks });
  } catch (err) {
    console.error('Todoist tasks endpoint error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { content, dueDate, due_date, hour_slot } = await request.json();
    const actualDueDate = dueDate || due_date; // Support both formats

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content required' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: integration } = await supabase
      .from('user_integrations')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provider', 'todoist')
      .single();

    if (!integration?.access_token) {
      return NextResponse.json({ error: 'Todoist not connected' }, { status: 400 });
    }

    let taskContent = content;
    if (hour_slot) {
      taskContent = `${content} [LIFEBOARD_META]{\"hourSlot\":\"${hour_slot}\"}[/LIFEBOARD_META]`;
    }

    const body: Record<string, string> = { content: taskContent };
    if (actualDueDate) {
      body['due_date'] = actualDueDate; // YYYY-MM-DD
    }

    const todoistRes = await fetch(TODOIST_TASKS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!todoistRes.ok) {
      const text = await todoistRes.text();
      console.error('Todoist create task error', todoistRes.status, text);
      return NextResponse.json({ error: 'Todoist API error', status: todoistRes.status }, { status: 502 });
    }

    const task = await todoistRes.json();

    return NextResponse.json({ task });
  } catch (err) {
    console.error('Todoist create task endpoint error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 