import { addMinutes } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CalendarRepeatRule = 'daily' | 'weekly' | 'weekdays' | 'monthly';

const REPEAT_WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR'];

export const IMPORTED_CALENDAR_BUCKET = 'Imported Calendar';

export function mapRruleToRepeatRule(rrule?: string | null): CalendarRepeatRule | null {
  if (!rrule) return null;

  const freqMatch = rrule.match(/FREQ=([^;]+)/i);
  if (!freqMatch) return null;

  const freq = freqMatch[1].toLowerCase();
  if (freq === 'daily') return 'daily';
  if (freq === 'monthly') return 'monthly';
  if (freq === 'weekly') {
    const byDayMatch = rrule.match(/BYDAY=([^;]+)/i);
    if (byDayMatch) {
      const days = byDayMatch[1]
        .split(',')
        .map((day) => day.trim().toUpperCase())
        .filter(Boolean);
      if (days.length === REPEAT_WEEKDAYS.length && days.every((day) => REPEAT_WEEKDAYS.includes(day))) {
        return 'weekdays';
      }
    }
    return 'weekly';
  }

  return null;
}

export function mapRepeatRuleToRrule(rule?: CalendarRepeatRule | null): string | null {
  if (!rule) return null;

  switch (rule) {
    case 'daily':
      return 'FREQ=DAILY';
    case 'weekly':
      return 'FREQ=WEEKLY';
    case 'weekdays':
      return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    case 'monthly':
      return 'FREQ=MONTHLY';
    default:
      return null;
  }
}

export function isoToHourSlot(dateTime?: string | null): string | null {
  if (!dateTime) return null;
  const timePart = dateTime.split('T')[1];
  if (!timePart) return null;
  const match = timePart.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (Number.isNaN(hour) || Number.isNaN(minutes)) return null;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  const minuteSegment = minutes > 0 ? `:${match[2]}` : '';
  return `hour-${normalizedHour}${minuteSegment}${suffix}`;
}

export function hourSlotToIso(date?: string | null, hourSlot?: string | null): string | null {
  if (!date || !hourSlot) return null;
  const normalized = hourSlot.replace(/^hour-/, '');
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  return `${date}T${hh}:${mm}:00`;
}

export function calculateDurationMinutes(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  const minutes = Math.round(diffMs / 60000);
  return minutes > 0 ? minutes : null;
}

export interface LifeboardTaskLike {
  id: string;
  content?: string | null;
  due_date?: string | null;
  hour_slot?: string | null;
  duration?: number | null;
  repeat_rule?: string | null;
}

export function buildCalendarUpdateFromTask(task: LifeboardTaskLike) {
  if (!task?.id) return null;

  const startDate = task.due_date ?? null;
  const startTime = hourSlotToIso(startDate, task.hour_slot ?? null);
  const durationMinutes = typeof task.duration === 'number' ? task.duration : null;

  let endDate: string | null = null;
  let endTime: string | null = null;

  if (startTime && durationMinutes && durationMinutes > 0) {
    const endDateObj = addMinutes(new Date(startTime), durationMinutes);
    const yyyy = endDateObj.getFullYear().toString().padStart(4, '0');
    const mm = (endDateObj.getMonth() + 1).toString().padStart(2, '0');
    const dd = endDateObj.getDate().toString().padStart(2, '0');
    const hh = endDateObj.getHours().toString().padStart(2, '0');
    const min = endDateObj.getMinutes().toString().padStart(2, '0');
    endDate = `${yyyy}-${mm}-${dd}`;
    endTime = `${endDate}T${hh}:${min}:00`;
  } else if (startDate) {
    endDate = startDate;
  }

  const repeatRule = mapRepeatRuleToRrule(task.repeat_rule as CalendarRepeatRule | null);

  return {
    title: task.content ?? null,
    start_date: startDate,
    start_time: startTime,
    end_date: endDate,
    end_time: endTime,
    all_day: startTime ? false : true,
    rrule: repeatRule,
    updated_at: new Date().toISOString(),
  };
}

type GenericSupabaseClient = SupabaseClient<any, any, any>;

export async function syncTaskToCalendarEvent(
  supabase: GenericSupabaseClient,
  userId: string,
  task: LifeboardTaskLike
): Promise<void> {
  const update = buildCalendarUpdateFromTask(task);
  if (!update) return;

  const { data: eventRows, error: lookupError } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('user_id', userId)
    .eq('task_id', task.id)
    .limit(1);

  if (lookupError) {
    console.error('Failed to look up linked calendar event', { taskId: task.id, lookupError });
    return;
  }

  if (!eventRows || eventRows.length === 0) {
    return;
  }

  const eventId = eventRows[0].id;
  const { error: updateError } = await supabase
    .from('calendar_events')
    .update(update)
    .eq('id', eventId)
    .eq('user_id', userId);

  if (updateError) {
    console.error('Failed to sync task changes to calendar event', { taskId: task.id, eventId, updateError });
  }
}
