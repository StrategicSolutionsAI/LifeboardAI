import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/server';
import { invalidateTodoistTaskCache } from '@/lib/todoist-task-cache';

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

interface TaskUpdate {
  taskId: string;
  updates: {
    content?: string;
    duration?: number;
    hourSlot?: string;
    bucket?: string | null;
    due?: { date: string };
    position?: number;
    [key: string]: any;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { updates }: { updates: TaskUpdate[] } = await request.json();

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'Invalid updates format' }, { status: 400 });
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

    // Process each update
    const results = [];
    let anySuccess = false;
    for (const update of updates) {
      try {
        // For Todoist API, we need to update the task content and description
        // We'll store our custom fields (duration, hourSlot) in the task description
        const currentTaskRes = await fetch(`${TODOIST_TASKS_ENDPOINT}/${update.taskId}`, {
          headers: {
            Authorization: `Bearer ${integration.access_token}`,
          },
        });

        if (!currentTaskRes.ok) {
          console.error(`Failed to fetch task ${update.taskId}`);
          continue;
        }

        const currentTask = await currentTaskRes.json();
        
        // Parse existing metadata from description
        let existingMeta = {};
        if (currentTask.description) {
          try {
            const metaMatch = currentTask.description.match(/\[LIFEBOARD_META\](.*?)\[\/LIFEBOARD_META\]/);
            if (metaMatch) {
              existingMeta = JSON.parse(metaMatch[1]);
            }
          } catch (e) {
            console.warn(`Failed to parse metadata for task ${update.taskId}:`, e);
            // Keep existing meta as empty object
          }
        }

        // Merge updates with existing metadata
        const newMeta: any = {
          ...existingMeta,
          ...(update.updates.duration !== undefined && { duration: update.updates.duration }),
          ...(update.updates.hourSlot !== undefined && { hourSlot: update.updates.hourSlot }),
          ...(update.updates.bucket !== undefined && { bucket: update.updates.bucket }),
          ...(update.updates.position !== undefined && { position: update.updates.position }),
        };

        const rawRepeatRule = update.updates.repeatRule;
        const normalizedRepeatRule = typeof rawRepeatRule === 'string' ? normalizeRepeatRule(rawRepeatRule) : undefined;
        const removeRepeatRule = rawRepeatRule === null || (typeof rawRepeatRule === 'string' && rawRepeatRule.trim().toLowerCase() === 'none');
        if (normalizedRepeatRule) {
          newMeta.repeatRule = normalizedRepeatRule;
        }

        // Handle null values by removing them from metadata  
        if (update.updates.hourSlot === null) {
          delete newMeta.hourSlot;
        }
        if (update.updates.duration === null) {
          delete newMeta.duration;
        }
        if (update.updates.bucket === null) {
          delete newMeta.bucket;
        }
        if (update.updates.position === null) {
          delete newMeta.position;
        }
        if (removeRepeatRule) {
          delete newMeta.repeatRule;
        }

        const metaKeys = Object.keys(newMeta).filter(key => newMeta[key] !== undefined);
        const baseDescription = currentTask.description?.replace(/\[LIFEBOARD_META\].*?\[\/LIFEBOARD_META\]/g, '').trim() || '';
        const newDescription = metaKeys.length > 0
          ? `${baseDescription}${baseDescription ? '\n' : ''}[LIFEBOARD_META]${JSON.stringify(newMeta)}[/LIFEBOARD_META]`
          : baseDescription;


        // Prepare update payload for Todoist
        const todoistUpdate: any = {};
        
        if (update.updates.content) {
          todoistUpdate.content = update.updates.content;
        }
        
        const dueUpdate = update.updates.due;
        const dueDateValue = dueUpdate?.date ?? undefined;

        if (normalizedRepeatRule) {
          const startingDate = dueDateValue || currentTask?.due?.date || null;
          const dueString = buildDueString(normalizedRepeatRule, startingDate);
          if (dueString) {
            todoistUpdate.due_string = dueString;
          }
        } else if (removeRepeatRule) {
          if (dueDateValue) {
            todoistUpdate.due_date = dueDateValue;
          } else if (dueUpdate === null || dueDateValue === undefined) {
            todoistUpdate.due_string = 'no date';
          }
        } else if (dueUpdate !== undefined) {
          if (dueDateValue) {
            todoistUpdate.due_date = dueDateValue;
          } else if (dueUpdate === null) {
            todoistUpdate.due_string = 'no date';
          }
        }

        // Always update description to include metadata
        todoistUpdate.description = newDescription.trim();

        // Update task in Todoist
        const updateRes = await fetch(`${TODOIST_TASKS_ENDPOINT}/${update.taskId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(todoistUpdate),
        });

        if (updateRes.ok) {
          const updatedTask = await updateRes.json();
          anySuccess = true;
          results.push({ 
            taskId: update.taskId, 
            success: true, 
            updatedTask 
          });
        } else {
          const errorText = await updateRes.text();
          console.error(`Failed to update task ${update.taskId}:`, {
            status: updateRes.status,
            error: errorText,
            updates: update.updates
          });
          results.push({ 
            taskId: update.taskId, 
            success: false, 
            error: errorText,
            status: updateRes.status
          });
        }
      } catch (error) {
        console.error(`Error updating task ${update.taskId}:`, error);
        results.push({ taskId: update.taskId, success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (anySuccess) {
      invalidateTodoistTaskCache(user.id);
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Batch update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
