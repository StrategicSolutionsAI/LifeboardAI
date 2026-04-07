import { useState, useCallback, useMemo, useEffect } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addDays,
} from "date-fns";
import type { RepeatOption, Task, TaskOccurrenceException } from "@/types/tasks";
import { useDataCache } from "@/hooks/use-data-cache";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { sanitizeBucketName } from "@/lib/task-form-utils";
import {
  type CalendarView,
  type DayEvent,
  normalizeRepeatOption,
  toDayKey,
  buildCrossSourceEventKey,
  buildMonthMatrix,
  buildWeekMatrix,
  buildDayMatrix,
  hourSlotToISO,
} from "@/features/calendar/types";

/* ─── Options ─── */

export interface UseCalendarEventsOptions {
  currentDate: Date;
  view: CalendarView;
  selectedBucketFilters: string[];
  uploadRefreshIndex: number;
  allTasks: Task[];
  getTaskForOccurrence: (task: Task, dateStr: string) => Task | null | undefined;
}

/* ─── Hook ─── */

export function useCalendarEvents({
  currentDate,
  view,
  selectedBucketFilters,
  uploadRefreshIndex,
  allTasks,
  getTaskForOccurrence,
}: UseCalendarEventsOptions) {
  // Optimistic overrides applied on top of the memoized base event map.
  // When callers use setEventsByDate, the patch is stored here and merged.
  // The patch auto-clears when the base inputs change (data re-fetched / tasks updated).
  const [optimisticPatch, setOptimisticPatch] = useState<
    ((prev: Record<string, DayEvent[]>) => Record<string, DayEvent[]>) | null
  >(null);

  /* ── O(1) task lookups ── */

  const taskLookup = useMemo(
    () => new Map(allTasks.map(t => [t.id?.toString(), t])),
    [allTasks],
  );

  // Title-based lookup for uploaded event → task matching (avoids allTasks.find() in externalEventMap)
  const taskTitleIndex = useMemo(() => {
    const index = new Map<string, Task>();
    for (const task of allTasks) {
      if (task.source !== 'supabase') continue;
      const bucketName = sanitizeBucketName(task.bucket);
      if (bucketName && bucketName !== 'Imported Calendar') continue;
      const dueDate = task.due?.date ?? '';
      const title = (task.content ?? '').trim().toLowerCase();
      if (dueDate && title) {
        index.set(`${dueDate}::${title}`, task);
      }
    }
    return index;
  }, [allTasks]);

  const resolveTaskById = useCallback(
    (taskId?: string | null) => {
      if (!taskId) return undefined;
      return taskLookup.get(taskId.toString());
    },
    [taskLookup],
  );

  /* ── Helper: normalize date strings ── */

  const normalizeDateString = useCallback((value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.length > 10 ? trimmed.slice(0, 10) : trimmed;
  }, []);

  /* ── Date range for current view ── */

  const dateRange = useMemo(() => {
    switch (view) {
      case 'month':
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
      case 'week':
        return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
      case 'day':
        return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
      case 'agenda':
        return { start: startOfDay(currentDate), end: endOfDay(addDays(currentDate, 13)) };
      default:
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
    }
  }, [currentDate, view]);

  const rangeStartMs = dateRange.start.getTime();
  const rangeEndMs = dateRange.end.getTime();

  /* ── Grid rows for current view ── */

  const rows = useMemo(() => {
    switch (view) {
      case 'month':
        return buildMonthMatrix(currentDate);
      case 'week':
        return buildWeekMatrix(currentDate);
      case 'day':
        return buildDayMatrix(currentDate);
      case 'agenda':
        return [];
      default:
        return buildMonthMatrix(currentDate);
    }
  }, [currentDate, view]);

  /* ── Build lifeboard events (useMemo — pure computation) ── */
  // Previously useCallback, but this is a deterministic function of its
  // inputs. Converting to useMemo avoids a callback identity change on
  // every allTasks update that previously cascaded into the master useEffect.

  const lifeboardEventMap = useMemo((): Record<string, DayEvent[]> => {
    const rangeStart = startOfDay(new Date(rangeStartMs));
    const rangeEnd = startOfDay(new Date(rangeEndMs));
    const result: Record<string, DayEvent[]> = {};
    const rStartMs = rangeStart.getTime();
    const rEndMs = rangeEnd.getTime();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const filterAll = selectedBucketFilters.includes('all');

    const assigneeFilters = selectedBucketFilters.filter(f => f.startsWith('assignee:')).map(f => f.slice(9));
    const hasAssigneeFilters = assigneeFilters.length > 0;
    // Pre-compute range boundary strings once instead of per-task
    const rangeStartStr = toDayKey(rangeStart);
    const rangeEndStr = toDayKey(rangeEnd);

    const addEvent = (dateStr: string, event: DayEvent) => {
      const bucket = result[dateStr] ?? (result[dateStr] = []);
      bucket.push(event);
    };

    const buildEventForDate = (task: Task, dateStr: string, taskStartStr: string, taskEndStr: string) => {
      const adjustedTask = getTaskForOccurrence(task, dateStr);
      if (!adjustedTask) return;

      if (!filterAll) {
        const taskBucket = adjustedTask.bucket || 'unassigned';
        const matchesBucket = selectedBucketFilters.includes(taskBucket);
        const matchesAssignee = hasAssigneeFilters && assigneeFilters.includes(adjustedTask.assigneeId ?? '');
        if (!matchesBucket && !matchesAssignee) return;
      }

      const repeatRule = adjustedTask.repeatRule ? (adjustedTask.repeatRule as RepeatOption) : undefined;
      const adjStart = adjustedTask.startDate ?? adjustedTask.due?.date;
      const adjEnd = adjustedTask.endDate ?? adjStart;
      const isRangeStart = dateStr === (adjStart ?? taskStartStr);
      const isRangeEnd = dateStr === (adjEnd ?? taskEndStr);
      const eventAllDay = adjustedTask.allDay === true;

      const baseEvent: DayEvent = {
        source: 'lifeboard',
        title: adjustedTask.content,
        allDay: eventAllDay,
        taskId: adjustedTask.id,
        repeatRule,
        bucket: adjustedTask.bucket,
        assigneeId: adjustedTask.assigneeId,
        startDate: adjStart ?? undefined,
        endDate: adjEnd ?? undefined,
        isRangeStart,
        isRangeEnd,
      };

      if (!eventAllDay && adjustedTask.hourSlot && isRangeStart) {
        baseEvent.time = hourSlotToISO(adjustedTask.hourSlot, dateStr);
        baseEvent.duration = adjustedTask.duration || 60;
      } else if (!eventAllDay && !isRangeStart) {
        baseEvent.time = undefined;
        baseEvent.duration = undefined;
      } else if (adjustedTask.duration) {
        baseEvent.duration = adjustedTask.duration;
      }

      addEvent(dateStr, baseEvent);
    };

    allTasks.forEach((task: Task) => {
      if (!task || task.completed) return;
      const startRaw = normalizeDateString(task.startDate ?? task.due?.date);
      if (!startRaw) return;
      const endRaw = normalizeDateString(task.endDate) ?? startRaw;

      const rule = task.repeatRule as string | undefined;
      if (!rule || rule === 'none') {
        // For non-recurring tasks, endDate must be >= startDate (defensive guard)
        const effectiveEnd = endRaw < startRaw ? startRaw : endRaw;
        const clampedStart = startRaw < rangeStartStr ? rangeStartStr : startRaw;
        const clampedEnd = effectiveEnd > rangeEndStr ? rangeEndStr : effectiveEnd;
        if (clampedStart > clampedEnd) return;

        let cursor = new Date(`${clampedStart}T00:00:00`);
        const end = new Date(`${clampedEnd}T00:00:00`);
        while (cursor <= end) {
          buildEventForDate(task, toDayKey(cursor), startRaw, endRaw);
          cursor = addDays(cursor, 1);
        }
        return;
      }

      const due = new Date(`${startRaw}T00:00:00`);
      const dueMs = due.getTime();
      if (dueMs > rEndMs) return;

      // If endDate is set and differs from startDate, treat it as the recurrence end boundary
      const recurrenceEndMs = (endRaw !== startRaw) ? new Date(`${endRaw}T23:59:59`).getTime() : rEndMs;
      const effectiveEndMs = Math.min(rEndMs, recurrenceEndMs);

      switch (task.repeatRule) {
        case 'daily': {
          let cursor = dueMs >= rStartMs ? due : rangeStart;
          while (cursor.getTime() <= effectiveEndMs) {
            buildEventForDate(task, toDayKey(cursor), startRaw, endRaw);
            cursor = addDays(cursor, 1);
          }
          break;
        }
        case 'weekdays': {
          let cursor = dueMs >= rStartMs ? due : rangeStart;
          while (cursor.getTime() <= effectiveEndMs) {
            const day = cursor.getDay();
            if (day >= 1 && day <= 5) {
              buildEventForDate(task, toDayKey(cursor), startRaw, endRaw);
            }
            cursor = addDays(cursor, 1);
          }
          break;
        }
        case 'weekly': {
          const dueDay = due.getDay();
          let cursor = dueMs >= rStartMs ? due : new Date(rStartMs);
          const cursorDay = cursor.getDay();
          let daysUntilMatch = (dueDay - cursorDay + 7) % 7;
          if (daysUntilMatch === 0) {
            const diffFromDue = Math.floor((cursor.getTime() - dueMs) / MS_PER_DAY);
            if (diffFromDue % 7 !== 0) daysUntilMatch = 7;
          }
          cursor = addDays(cursor, daysUntilMatch);
          while (cursor.getTime() <= effectiveEndMs) {
            buildEventForDate(task, toDayKey(cursor), startRaw, endRaw);
            cursor = addDays(cursor, 7);
          }
          break;
        }
        case 'monthly': {
          const dueDateNum = due.getDate();
          let month = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
          const rangeEndMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth() + 1, 0);
          while (month <= rangeEndMonth) {
            const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
            const targetDateNum = dueDateNum > daysInMonth ? daysInMonth : dueDateNum;
            const candidate = new Date(month.getFullYear(), month.getMonth(), targetDateNum);
            if (candidate.getTime() >= dueMs && candidate.getTime() >= rStartMs && candidate.getTime() <= effectiveEndMs) {
              buildEventForDate(task, toDayKey(candidate), startRaw, endRaw);
            }
            month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
          }
          break;
        }
        default:
          break;
      }
    });

    return result;
  }, [allTasks, getTaskForOccurrence, normalizeDateString, selectedBucketFilters, rangeStartMs, rangeEndMs]);

  /* ── Ensure task for uploaded event ── */

  const ensureTaskForEvent = useCallback(async (eventId: string) => {
    try {
      const resp = await fetch(`/api/calendar/events/${eventId}/ensure-task`, {
        method: 'POST',
        cache: 'no-store',
      });
      if (resp.ok) {
        const payload = await resp.json();
        if (!payload?.taskId) return null;
        return {
          taskId: payload.taskId as string,
          bucket: sanitizeBucketName(payload.bucket),
          repeatRule: normalizeRepeatOption(payload.repeatRule),
        };
      }

      if (resp.status !== 404) {
        console.error('Failed to ensure calendar event has task', resp.status);
        try {
          const errorPayload = await resp.json();
          console.error('Ensure task error payload', errorPayload);
        } catch {}
        return null;
      }

      const fallbackResp = await fetch('/api/calendar/upload', { cache: 'no-store' });
      if (!fallbackResp.ok) {
        console.error('Fallback calendar fetch failed', fallbackResp.status);
        return null;
      }
      const payload = await fallbackResp.json();
      const events = Array.isArray(payload.events) ? payload.events : [];
      const target = events.find((event: any) => event?.id === eventId);
      if (!target?.task_id) return null;
      return {
        taskId: target.task_id as string,
        bucket: sanitizeBucketName(target.bucket),
        repeatRule: normalizeRepeatOption(target.repeat_rule),
      };
    } catch (error) {
      console.error('Failed to ensure calendar event has task', error);
      return null;
    }
  }, []);

  /* ── Data Fetching: Google Calendar ── */

  const googleCacheKey = useMemo(() => {
    const startKey = toDayKey(new Date(rangeStartMs));
    const endKey = toDayKey(new Date(rangeEndMs));
    return `calendar-google-${view}-${startKey}-${endKey}`;
  }, [rangeStartMs, rangeEndMs, view]);

  const googleEventsFetcher = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        timeMin: new Date(rangeStartMs).toISOString(),
        timeMax: new Date(rangeEndMs).toISOString(),
        maxResults: '500',
      });
      const resp = await fetchWithTimeout(`/api/integrations/google/calendar/events?${params.toString()}`);
      if (!resp.ok) {
        if (resp.status === 401) return [];
        throw new Error(`Failed to fetch Google events: ${resp.status}`);
      }
      const payload = await resp.json();
      return Array.isArray(payload.events) ? payload.events : [];
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return [];
      console.error('Failed to fetch Google events', error);
      return [];
    }
  }, [rangeStartMs, rangeEndMs]);

  const { data: googleEventsRaw } = useDataCache<any[] | null>(googleCacheKey, googleEventsFetcher, {
    ttl: 5 * 60 * 1000,
    prefetch: false,
  });
  const googleEvents = useMemo(() => (Array.isArray(googleEventsRaw) ? googleEventsRaw : []), [googleEventsRaw]);

  /* ── Data Fetching: Uploaded Calendar ── */

  const uploadedEventsCacheKey = `uploaded-calendar-events-${uploadRefreshIndex}`;
  const uploadedEventsFetcher = useCallback(async () => {
    try {
      const resp = await fetchWithTimeout('/api/calendar/upload', { cache: 'no-store' });
      if (!resp.ok) {
        if (resp.status === 401) return [];
        throw new Error(`Failed to fetch uploaded events: ${resp.status}`);
      }
      const payload = await resp.json();
      return Array.isArray(payload.events) ? payload.events : [];
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return [];
      console.error('Failed to fetch uploaded calendar events', error);
      return [];
    }
  }, []);

  const { data: uploadedEventsRaw } = useDataCache<any[] | null>(uploadedEventsCacheKey, uploadedEventsFetcher, {
    ttl: 5 * 60 * 1000,
    prefetch: false,
  });
  const uploadedEvents = useMemo(() => (Array.isArray(uploadedEventsRaw) ? uploadedEventsRaw : []), [uploadedEventsRaw]);

  /* ── Data Fetching: Cycle Tracking ── */

  const cycleCacheKey = `cycle-tracking-calendar`;
  const cycleEntriesFetcher = useCallback(async () => {
    try {
      const resp = await fetchWithTimeout('/api/widgets/cycle-tracking?limit=90', { cache: 'no-store' });
      if (!resp.ok) return [];
      const data = await resp.json();
      return Array.isArray(data?.entries) ? data.entries : [];
    } catch {
      return [];
    }
  }, []);

  const { data: cycleEntriesRaw } = useDataCache<any[] | null>(cycleCacheKey, cycleEntriesFetcher, {
    ttl: 5 * 60 * 1000,
    prefetch: false,
  });
  const cycleEntries = useMemo(() => (Array.isArray(cycleEntriesRaw) ? cycleEntriesRaw : []), [cycleEntriesRaw]);

  /* ── External-source event map (Google, uploaded, cycle) ── */
  // Separated from lifeboard so that task changes only recompute the
  // lifeboard portion — external sources are independent of allTasks.

  const IMPORTED_CALENDAR_BUCKET_NAME = 'Imported Calendar';

  const externalEventMap = useMemo(() => {
    const map: Record<string, DayEvent[]> = {};
    const seenTaskInstanceKeys = new Set<string>();

    // Google Calendar events
    googleEvents.forEach((ev: any) => {
      if (!selectedBucketFilters.includes('all') && !selectedBucketFilters.includes('google')) return;

      const startInfo = ev?.start ?? {};
      const dateStr = startInfo.date ?? (startInfo.dateTime ? startInfo.dateTime.slice(0, 10) : undefined);
      if (!dateStr) return;
      const bucket = map[dateStr] ?? (map[dateStr] = []);
      bucket.push({
        source: 'google',
        title: ev.summary ?? 'Event',
        time: startInfo.dateTime ?? undefined,
        allDay: Boolean(startInfo.date),
      });
    });

    // Uploaded calendar events — use taskLookup for O(1) matching
    const rangeStart = startOfDay(new Date(rangeStartMs));
    const rangeEnd = startOfDay(new Date(rangeEndMs));

    const assigneeFiltersExt = selectedBucketFilters.filter(f => f.startsWith('assignee:')).map(f => f.slice(9));
    const hasAssigneeFiltersExt = assigneeFiltersExt.length > 0;

    uploadedEvents.forEach((ev: any) => {
      if (!selectedBucketFilters.includes('all') && !selectedBucketFilters.includes('uploaded')) {
        // Still show if event matches an active assignee filter
        const evAssignee = ev.default_assignee ?? undefined;
        if (!hasAssigneeFiltersExt || !evAssignee || !assigneeFiltersExt.includes(evAssignee)) return;
      }

      const startDateStr = ev.start_date || (ev.start_time ? ev.start_time.slice(0, 10) : undefined);
      if (!startDateStr) return;
      const endDateStr = ev.end_date || startDateStr;

      const startDateObj = startOfDay(new Date(`${startDateStr}T00:00:00`));
      const endDateObj = startOfDay(new Date(`${endDateStr}T00:00:00`));

      if (endDateObj < rangeStart || startDateObj > rangeEnd) return;

      let resolvedTaskId: string | undefined = ev.task_id ?? undefined;
      let matchedTask: any | undefined;

      if (resolvedTaskId) {
        matchedTask = resolveTaskById(resolvedTaskId);
      }

      if (!matchedTask) {
        if (resolvedTaskId) {
          // ID-based fallback via O(1) lookup
          matchedTask = taskLookup.get(resolvedTaskId);
        } else {
          // Title-based O(1) lookup for unlinked uploaded events
          const normalizedTitle = (ev.title ?? '').trim().toLowerCase();
          matchedTask = taskTitleIndex.get(`${startDateStr}::${normalizedTitle}`);
        }
        if (matchedTask?.id && !resolvedTaskId) {
          resolvedTaskId = matchedTask.id?.toString?.() ?? matchedTask.id;
        }
      }

      const resolvedBucket = sanitizeBucketName(matchedTask?.bucket) ?? sanitizeBucketName(ev.bucket);
      const resolvedRepeatRule = normalizeRepeatOption(matchedTask?.repeatRule ?? ev.repeat_rule);
      const eventAllDay = ev.all_day || (!ev.start_time && !ev.hour_slot && !ev.end_hour_slot);

      let cursor = startDateObj;
      while (cursor.getTime() <= endDateObj.getTime()) {
        if (cursor.getTime() >= rangeStart.getTime() && cursor.getTime() <= rangeEnd.getTime()) {
          const dayKey = toDayKey(cursor);
          const bucket = map[dayKey] ?? (map[dayKey] = []);
          const taskIdKey = resolvedTaskId ? resolvedTaskId.toString() : undefined;
          const seenKey = taskIdKey ? `${taskIdKey}-${dayKey}` : undefined;
          if (seenKey && seenTaskInstanceKeys.has(seenKey)) {
            cursor = addDays(cursor, 1);
            continue;
          }

          const isRangeStart = dayKey === startDateStr;
          const isRangeEnd = dayKey === endDateStr;
          const resolvedHourSlot = typeof matchedTask?.hourSlot === 'string'
            ? matchedTask.hourSlot
            : typeof ev.hour_slot === 'string'
              ? ev.hour_slot
              : undefined;

          let eventTime: string | undefined;
          if (!eventAllDay && isRangeStart) {
            if (resolvedHourSlot) {
              eventTime = hourSlotToISO(resolvedHourSlot, startDateStr);
            }
            if (!eventTime && ev.start_time) {
              eventTime = ev.start_time ?? undefined;
            }
          }

          // Resolve assignee: matched task takes priority, then import-level default
          const resolvedAssigneeId = matchedTask?.assigneeId ?? ev.default_assignee ?? undefined;

          bucket.push({
            source: resolvedTaskId ? 'lifeboard' : 'uploaded',
            title: ev.title ?? 'Uploaded Event',
            time: eventTime,
            allDay: eventAllDay || (!isRangeStart && !isRangeEnd),
            location: ev.location ?? undefined,
            taskId: resolvedTaskId,
            bucket: resolvedBucket,
            assigneeId: resolvedAssigneeId,
            repeatRule: resolvedRepeatRule,
            eventId: ev.id,
            startDate: startDateStr,
            endDate: endDateStr,
            isRangeStart,
            isRangeEnd,
          });

          if (seenKey) seenTaskInstanceKeys.add(seenKey);
        }
        cursor = addDays(cursor, 1);
      }
    });

    // Cycle tracking entries
    cycleEntries.forEach((entry: any) => {
      const dateStr = typeof entry.date === 'string' ? entry.date.slice(0, 10) : undefined;
      if (!dateStr) return;
      const flow = entry.flow_intensity || 'none';
      if (flow === 'none') return;
      const flowLabel = flow.charAt(0).toUpperCase() + flow.slice(1);
      const symptoms: string[] = Array.isArray(entry.symptoms) ? entry.symptoms : [];
      const title = entry.period_start
        ? `Period Start \u2014 ${flowLabel} flow`
        : `${flowLabel} flow${symptoms.length ? ' \u00B7 ' + symptoms.slice(0, 2).join(', ') : ''}`;
      const bucket = map[dateStr] ?? (map[dateStr] = []);
      bucket.push({ source: 'cycle', title, allDay: true });
    });

    return { map, seenTaskInstanceKeys };
  }, [googleEvents, uploadedEvents, cycleEntries, rangeStartMs, rangeEndMs, selectedBucketFilters, taskLookup, taskTitleIndex, resolveTaskById]);

  /* ── Merged event map (external + lifeboard, deduped) ── */
  // Both halves are useMemo. When allTasks changes, only lifeboardEventMap
  // recomputes. When Google/uploaded/cycle data changes, only externalEventMap
  // recomputes. The merge is lightweight — just concatenation + dedup.

  const computedEventsByDate = useMemo(() => {
    const { map: extMap, seenTaskInstanceKeys } = externalEventMap;
    // Clone both the map and the seen-set so we never mutate the memoized externalEventMap value
    const seen = new Set(seenTaskInstanceKeys);
    const map: Record<string, DayEvent[]> = {};
    for (const dateStr of Object.keys(extMap)) {
      map[dateStr] = [...extMap[dateStr]];
    }

    // Merge lifeboard events, skipping already-seen task instances
    for (const dateStr of Object.keys(lifeboardEventMap)) {
      const bucket = map[dateStr] ?? (map[dateStr] = []);
      for (const event of lifeboardEventMap[dateStr]) {
        const taskIdKey = event.taskId ? event.taskId.toString() : undefined;
        const seenKey = taskIdKey ? `${taskIdKey}-${dateStr}` : undefined;
        if (seenKey && seen.has(seenKey)) continue;
        bucket.push(event);
        if (seenKey) seen.add(seenKey);
      }
    }

    // Cross-source dedup: prefer lifeboard entries over imported/Google
    for (const dateStr of Object.keys(map)) {
      const events = map[dateStr];
      const lifeboardKeys = new Set(
        events
          .filter((event) => event.source === 'lifeboard')
          .map((event) => buildCrossSourceEventKey(event)),
      );
      if (lifeboardKeys.size === 0) continue;
      map[dateStr] = events.filter((event) => {
        if (event.source === 'lifeboard' || event.taskId) return true;
        return !lifeboardKeys.has(buildCrossSourceEventKey(event));
      });
    }

    return map;
  }, [externalEventMap, lifeboardEventMap]);

  // Auto-clear optimistic patch when the base data changes (e.g. after
  // batchUpdateTasks optimistically updates allTasks → lifeboardEventMap
  // recomputes → computedEventsByDate already reflects the change).
  // Without this, the stale patch re-applies on top of the updated base,
  // causing duplicate events at the destination date.
  useEffect(() => {
    setOptimisticPatch(null);
  }, [computedEventsByDate]);

  // Apply optimistic patch on top of computed base, then dedup by taskId
  // within each date to prevent duplicates from overlapping update paths.
  const finalEventsByDate = useMemo(() => {
    const base = optimisticPatch ? optimisticPatch(computedEventsByDate) : computedEventsByDate;

    // Dedup: keep only the first event per taskId per date
    let needsDedup = false;
    for (const dateStr of Object.keys(base)) {
      const events = base[dateStr];
      const seen = new Set<string>();
      for (const event of events) {
        if (!event.taskId) continue;
        const key = event.taskId.toString();
        if (seen.has(key)) { needsDedup = true; break; }
        seen.add(key);
      }
      if (needsDedup) break;
    }

    if (!needsDedup) return base;

    const result: Record<string, DayEvent[]> = {};
    for (const dateStr of Object.keys(base)) {
      const seen = new Set<string>();
      result[dateStr] = base[dateStr].filter(event => {
        if (!event.taskId) return true;
        const key = event.taskId.toString();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return result;
  }, [computedEventsByDate, optimisticPatch]);

  // setEventsByDate: accepts a function (prev => next) for optimistic updates.
  // Compatible with the existing callers in use-calendar-actions.ts and full-calendar.tsx.
  const setEventsByDate = useCallback(
    (updater: React.SetStateAction<Record<string, DayEvent[]>>) => {
      if (typeof updater === 'function') {
        setOptimisticPatch(() => updater as (prev: Record<string, DayEvent[]>) => Record<string, DayEvent[]>);
      } else {
        setOptimisticPatch(() => () => updater);
      }
    },
    [],
  );

  return {
    eventsByDate: finalEventsByDate,
    setEventsByDate,
    googleEvents,
    uploadedEvents,
    resolveTaskById,
    ensureTaskForEvent,
    rows,
    dateRange,
  };
}
