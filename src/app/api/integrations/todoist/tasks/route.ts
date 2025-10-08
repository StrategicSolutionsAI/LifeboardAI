import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import {
  readTodoistTaskCache,
  writeTodoistTaskCache,
  getTodoistPendingFetch,
  setTodoistPendingFetch,
  clearTodoistPendingFetch,
  invalidateTodoistTaskCache
} from '@/lib/todoist-task-cache';

const TODOIST_TASKS_ENDPOINT = 'https://api.todoist.com/rest/v2/tasks';

type RepeatRule = 'daily' | 'weekly' | 'weekdays' | 'monthly';

const normalizeRepeatRule = (value?: string | null): RepeatRule | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  const base = normalized.replace(/\s+starting\s+.+$/, '');
  switch (normalized) {
    case 'none':
      return undefined;
    case 'every day':
    case 'daily':
      return 'daily';
    case 'every week':
    case 'weekly':
      return 'weekly';
    case 'every weekday':
    case 'weekdays':
    case 'every workday':
      return 'weekdays';
    case 'every month':
    case 'monthly':
      return 'monthly';
  }
  switch (base) {
    case 'every day':
    case 'daily':
      return 'daily';
    case 'every week':
    case 'weekly':
      return 'weekly';
    case 'every weekday':
    case 'weekdays':
    case 'every workday':
      return 'weekdays';
    case 'every month':
    case 'monthly':
      return 'monthly';
    default:
      return undefined;
  }
};

const buildDueString = (rule: RepeatRule, startDate?: string | null) => {
  const base = (() => {
    switch (rule) {
      case 'daily':
        return 'every day';
      case 'weekly':
        return 'every week';
      case 'weekdays':
        return 'every weekday';
      case 'monthly':
        return 'every month';
      default:
        return '';
    }
  })();
  if (!base) return undefined;
  if (startDate) return `${base} starting ${startDate}`;
  return base;
};

class TodoistFetchError extends Error {
  status: number;
  body?: string;

  constructor(status: number, body?: string) {
    super(`Todoist request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

const filterTasksByDate = (tasks: any[], date: string) =>
  tasks.filter((task: any) => {
    const due = task?.due;
    if (!due) return false;
    if (typeof due.date === 'string') {
      return due.date.slice(0, 10) === date;
    }
    if (typeof due.datetime === 'string') {
      return due.datetime.slice(0, 10) === date;
    }
    return false;
  });

const sortTasksByPosition = (tasks: any[]) => {
  const sorted = [...tasks];
  sorted.sort((a: any, b: any) => {
    const posA = a?.position ?? Number.MAX_SAFE_INTEGER;
    const posB = b?.position ?? Number.MAX_SAFE_INTEGER;
    return posA - posB;
  });
  return sorted;
};

const enhanceTodoistTask = (task: any) => {
  let metadata: { duration?: number; hourSlot?: string; bucket?: string; position?: number; repeatRule?: RepeatRule } = {};
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

  if (task.content) {
    try {
      const contentMetaMatch = task.content.match(/^(.*?)\s*\[LIFEBOARD_META\].*?\[\/LIFEBOARD_META\]$/);
      if (contentMetaMatch) {
        cleanContent = contentMetaMatch[1].trim();

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
    content: cleanContent,
    duration: metadata.duration,
    hourSlot: metadata.hourSlot,
    bucket: metadata.bucket,
    position: metadata.position,
    repeatRule: metadata.repeatRule ?? (task.due?.is_recurring ? normalizeRepeatRule(task.due?.string) : undefined),
  };
};

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

    const respondWithTasks = (tasks: any[]) => {
      if (date && !allParam) {
        return NextResponse.json({ tasks: filterTasksByDate(tasks, date) });
      }
      if (allParam) {
        return NextResponse.json({ tasks: sortTasksByPosition(tasks) });
      }
      return NextResponse.json({ tasks });
    };

    const cachedTasks = readTodoistTaskCache(user.id);
    if (cachedTasks) {
      return respondWithTasks(cachedTasks);
    }

    const pending = getTodoistPendingFetch(user.id);
    if (pending) {
      try {
        const tasks = await pending;
        return respondWithTasks(tasks);
      } catch (err) {
        clearTodoistPendingFetch(user.id);
        throw err;
      }
    }

    const fetchPromise = (async () => {
      const todoistRes = await fetch(TODOIST_TASKS_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${integration.access_token}`,
        },
      });

      if (!todoistRes.ok) {
        const text = await todoistRes.text().catch(() => '');
        throw new TodoistFetchError(todoistRes.status, text);
      }

      const tasks = await todoistRes.json();
      const list = Array.isArray(tasks) ? tasks : [];
      return list.map(enhanceTodoistTask);
    })();

    setTodoistPendingFetch(user.id, fetchPromise);

    let enhancedTasks: any[];
    try {
      enhancedTasks = await fetchPromise;
    } catch (err) {
      clearTodoistPendingFetch(user.id);
      if (err instanceof TodoistFetchError) {
        console.error('Todoist API error', err.status, err.body);
        if (err.status === 401 || err.status === 403) {
          return NextResponse.json({ error: 'Todoist auth error', status: err.status }, { status: 401 });
        }
        if (err.status === 429) {
          return NextResponse.json({ error: 'Todoist rate limited', status: 429 }, { status: 429 });
        }
        const body = (err.body || '').slice(0, 400);
        return NextResponse.json({ error: 'Todoist API error', status: 502, upstreamStatus: err.status, upstreamBody: body }, { status: 502 });
      }
      throw err;
    }

    clearTodoistPendingFetch(user.id);
    writeTodoistTaskCache(user.id, enhancedTasks);

    return respondWithTasks(enhancedTasks);
  } catch (err) {
    console.error('Todoist tasks endpoint error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { content, dueDate, due_date, hour_slot, bucket, repeat_rule, repeatRule } = await request.json();
    let actualDueDate: string | null = (dueDate || due_date) || null; // Support both formats
    const requestedRepeat = typeof repeat_rule === 'string' ? repeat_rule : (typeof repeatRule === 'string' ? repeatRule : undefined);
    const repeatRuleNormalized = normalizeRepeatRule(requestedRepeat);

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content required' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn('Todoist create: no user in session')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: integration } = await supabase
      .from('user_integrations')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provider', 'todoist')
      .single();

    if (!integration?.access_token) {
      console.warn('Todoist create: missing access token')
      return NextResponse.json({ error: 'Todoist not connected' }, { status: 400 });
    }

    const metadata: { hourSlot?: string; bucket?: string; repeatRule?: RepeatRule } = {};
    if (typeof hour_slot === 'number') {
      const h = Math.max(0, Math.min(23, hour_slot))
      const display = (() => {
        if (h === 0) return '12AM'
        if (h < 12) return `${h}AM`
        if (h === 12) return '12PM'
        return `${h - 12}PM`
      })()
      metadata.hourSlot = `hour-${display}`
    }
    if (bucket) metadata.bucket = bucket;
    if (repeatRuleNormalized) metadata.repeatRule = repeatRuleNormalized;
    
    // Normalize obviously stale years (e.g., model emitted 2023). If the
    // provided due date is in a past year, bump to the current year while
    // preserving month/day. This mirrors safeguards in /api/chat routes and
    // also covers realtime client-created tasks.
    if (actualDueDate && /^\d{4}-\d{2}-\d{2}$/.test(actualDueDate)) {
      try {
        const yr = Number(actualDueDate.slice(0, 4))
        const nowYr = new Date().getFullYear()
        if (yr < nowYr) {
          actualDueDate = `${nowYr}${actualDueDate.slice(4)}`
        }
      } catch {}
    }

    const body: Record<string, string> = { content };
    if (repeatRuleNormalized) {
      const dueString = buildDueString(repeatRuleNormalized, actualDueDate);
      if (dueString) {
        body['due_string'] = dueString;
      }
    } else if (actualDueDate) {
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
      console.error('Todoist create task error', todoistRes.status, (text || '').slice(0, 200));
      return NextResponse.json({ error: 'Todoist API error', status: todoistRes.status }, { status: 502 });
    }

    const task = await todoistRes.json();
    invalidateTodoistTaskCache(user.id)
    return NextResponse.json({ task });
  } catch (err) {
    console.error('Todoist create task endpoint error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 
