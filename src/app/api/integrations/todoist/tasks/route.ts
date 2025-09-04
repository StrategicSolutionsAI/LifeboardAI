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
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Authentication error', details: authError.message }, { status: 401 });
    }
    
    if (!user) {
      console.error('No user found in session');
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
      let metadata: { duration?: number; hourSlot?: string; bucket?: string; position?: number } = {};
      let cleanContent = task.content;
      
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
      
      // Also check content for metadata (in case it was stored there)
      if (task.content) {
        try {
          const contentMetaMatch = task.content.match(/^(.*?)\s*\[LIFEBOARD_META\].*?\[\/LIFEBOARD_META\]$/);
          if (contentMetaMatch) {
            // Extract clean content before metadata
            cleanContent = contentMetaMatch[1].trim();
            
            // Also parse metadata from content if not found in description
            if (Object.keys(metadata).length === 0) {
              const metaMatch = task.content.match(/\[LIFEBOARD_META\](.*?)\[\/LIFEBOARD_META\]/);
              if (metaMatch) {
                metadata = JSON.parse(metaMatch[1]);
              }
            }
          }
        } catch (e) {
          // Ignore parsing errors, keep original content
        }
      }
      
      return {
        ...task,
        content: cleanContent, // Use cleaned content
        duration: metadata.duration, // Only include if exists
        hourSlot: metadata.hourSlot, // Only include if exists - no default
        bucket: metadata.bucket, // Only include if exists
        position: metadata.position, // For custom ordering in Master List
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
    const { content, dueDate, due_date, hour_slot, bucket } = await request.json();
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

    const metadata: { hourSlot?: string; bucket?: string } = {};
    if (hour_slot) metadata.hourSlot = hour_slot;
    if (bucket) metadata.bucket = bucket;
    
    const body: Record<string, string> = { content };
    if (actualDueDate) {
      body['due_date'] = actualDueDate; // YYYY-MM-DD
    }
    
    // Store metadata in description field instead of content
    if (Object.keys(metadata).length > 0) {
      body['description'] = `[LIFEBOARD_META]${JSON.stringify(metadata)}[/LIFEBOARD_META]`;
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
