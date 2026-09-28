// iCalendar parsing and row mapping, shared by one-off .ics uploads and
// subscribed calendar feeds (src/lib/calendar/ics-import.ts).
import { calculateDurationMinutes, isoToHourSlot, mapRruleToRepeatRule } from '@/lib/calendar-sync';

export interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  rrule?: string;
}

const timeZoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

type DateTimeComponents = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getTimeZoneFormatter(timeZone: string): Intl.DateTimeFormat {
  const cacheKey = timeZone;
  const cached = timeZoneFormatterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  timeZoneFormatterCache.set(cacheKey, formatter);
  return formatter;
}

function extractDateTimeParts(parts: Intl.DateTimeFormatPart[]): DateTimeComponents | null {
  const extracted: Partial<DateTimeComponents> = {};

  for (const part of parts) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day' || part.type === 'hour' || part.type === 'minute' || part.type === 'second') {
      const value = Number.parseInt(part.value, 10);
      if (Number.isNaN(value)) {
        return null;
      }
      (extracted as Record<string, number>)[part.type] = value;
    }
  }

  if (
    extracted.year === undefined ||
    extracted.month === undefined ||
    extracted.day === undefined ||
    extracted.hour === undefined ||
    extracted.minute === undefined ||
    extracted.second === undefined
  ) {
    return null;
  }

  return extracted as DateTimeComponents;
}

function resolveTimeZoneOffset(components: DateTimeComponents, timeZone: string): { instant: number; offsetMinutes: number } | null {
  let formatter: Intl.DateTimeFormat;

  try {
    formatter = getTimeZoneFormatter(timeZone);
  } catch (error) {
    console.warn('Unable to create formatter for timezone, falling back to naive datetime', { timeZone, error });
    return null;
  }

  const targetMs = Date.UTC(
    components.year,
    components.month - 1,
    components.day,
    components.hour,
    components.minute,
    components.second,
  );

  let instant = targetMs;

  for (let i = 0; i < 6; i++) {
    const parts = formatter.formatToParts(new Date(instant));
    const zoned = extractDateTimeParts(parts);
    if (!zoned) {
      return null;
    }

    const zonedMs = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    );

    const delta = targetMs - zonedMs;

    if (Math.abs(delta) < 1000) {
      const offsetMinutes = Math.round((targetMs - instant) / 60000);
      return { instant, offsetMinutes };
    }

    instant += delta;
  }

  const offsetMinutes = Math.round((targetMs - instant) / 60000);
  return { instant, offsetMinutes };
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absMinutes / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (absMinutes % 60)
    .toString()
    .padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

export function parseICSFile(icsContent: string): ICSEvent[] {
  const events: ICSEvent[] = [];
  const lines = icsContent.split(/\r?\n/);

  let currentEvent: Partial<ICSEvent> | null = null;
  let currentProperty = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Handle line continuation (lines starting with space or tab)
    while (i + 1 < lines.length && /^[\s\t]/.test(lines[i + 1])) {
      i++;
      line += lines[i].trim();
    }

    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.uid && currentEvent.summary) {
        events.push(currentEvent as ICSEvent);
      }
      currentEvent = null;
    } else if (currentEvent && line.includes(':')) {
      const colonIndex = line.indexOf(':');
      const property = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);

      // Parse property and parameters
      const [propName, ...params] = property.split(';');
      const paramMap: Record<string, string> = {};

      params.forEach(param => {
        const [key, val] = param.split('=');
        if (key && val) {
          paramMap[key.toUpperCase()] = val;
        }
      });

      switch (propName.toUpperCase()) {
        case 'UID':
          currentEvent.uid = value;
          break;
        case 'SUMMARY':
          currentEvent.summary = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
          break;
        case 'DESCRIPTION':
          currentEvent.description = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
          break;
        case 'LOCATION':
          currentEvent.location = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
          break;
        case 'DTSTART':
          if (!currentEvent.start) currentEvent.start = {};
          if (paramMap.VALUE === 'DATE') {
            // All-day event
            currentEvent.start.date = formatDateOnly(value);
          } else {
            // Timed event
            currentEvent.start.dateTime = formatDateTime(value, paramMap.TZID);
            if (paramMap.TZID) {
              currentEvent.start.timeZone = paramMap.TZID;
            }
          }
          break;
        case 'DTEND':
          if (!currentEvent.end) currentEvent.end = {};
          if (paramMap.VALUE === 'DATE') {
            // All-day event
            currentEvent.end.date = formatDateOnly(value);
          } else {
            // Timed event
            currentEvent.end.dateTime = formatDateTime(value, paramMap.TZID);
            if (paramMap.TZID) {
              currentEvent.end.timeZone = paramMap.TZID;
            }
          }
          break;
        case 'RRULE':
          currentEvent.rrule = value;
          break;
      }
    }
  }

  return events;
}

function formatDateTime(raw: string, timeZone?: string): string {
  const normalized = raw.trim();

  // Match YYYYMMDDT followed by a variable length time (2-6 digits) with optional Z
  const match = normalized.match(/^(\d{8})T(\d{1,6})(Z)?$/i);
  if (!match) {
    return normalized;
  }

  const [, datePart, timePart, zFlag] = match;
  const year = datePart.substring(0, 4);
  const month = datePart.substring(4, 6);
  const day = datePart.substring(6, 8);

  // Pad the time section to HHMMSS
  const paddedTime = timePart.padEnd(6, '0').slice(0, 6);
  const hour = paddedTime.substring(0, 2);
  const minute = paddedTime.substring(2, 4);
  const second = paddedTime.substring(4, 6);
  if (zFlag) {
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }

  if (timeZone) {
    const components: DateTimeComponents = {
      year: Number.parseInt(year, 10),
      month: Number.parseInt(month, 10),
      day: Number.parseInt(day, 10),
      hour: Number.parseInt(hour, 10),
      minute: Number.parseInt(minute, 10),
      second: Number.parseInt(second, 10),
    };

    if (Object.values(components).every((value) => Number.isFinite(value))) {
      const resolved = resolveTimeZoneOffset(components, timeZone);
      if (resolved) {
        const offset = formatOffset(resolved.offsetMinutes);
        return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
      }
    }
  }

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function formatDateOnly(icsDate: string): string {
  // ICS format: YYYYMMDD
  if (icsDate.length === 8) {
    const year = icsDate.substring(0, 4);
    const month = icsDate.substring(4, 6);
    const day = icsDate.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  return icsDate;
}



/** calendar_events rows for parsed events; events with no start are skipped. */
export function icsEventsToRows(
  events: ICSEvent[],
  opts: { userId: string; importId: string; bucket: string | null },
): Array<Record<string, any>> {
return events.reduce<Array<Record<string, any>>>((acc, event) => {
    const start = event.start ?? {};
    const end = event.end ?? {};

    const startTime = start.dateTime || null;
    const startDate = start.date || (startTime ? startTime.slice(0, 10) : null);
    const hourSlot = startTime ? isoToHourSlot(startTime) : null;
    const endHourSlot = end.dateTime ? isoToHourSlot(end.dateTime) : null;
    const durationMinutes = calculateDurationMinutes(startTime, end.dateTime || null);
    const normalizedRepeatRule = mapRruleToRepeatRule(event.rrule);
    const timestamp = new Date().toISOString();

    if (!startDate && !startTime) {
      console.warn('Skipping calendar event without start date/time', { uid: event.uid });
      return acc;
    }

    acc.push({
      user_id: opts.userId,
      external_id: event.uid,
      source: 'uploaded_calendar',
      import_id: opts.importId,
      title: event.summary,
      content: event.summary,
      description: event.description || null,
      start_time: startTime,
      start_date: startDate,
      end_time: end.dateTime || null,
      end_date: end.date || null,
      timezone: start.timeZone || null,
      location: event.location || null,
      all_day: Boolean(start.date) && !startTime,
      rrule: event.rrule || null,
      repeat_rule: normalizedRepeatRule ?? null,
      due_date: startDate,
      hour_slot: hourSlot,
      end_hour_slot: endHourSlot,
      bucket: opts.bucket,
      duration: durationMinutes ?? null,
      completed: false,
      position: null,
      created_at: timestamp,
      updated_at: timestamp,
    });

    return acc;
  }, []);
}

/** The calendar's own display name (X-WR-CALNAME), if it declares one. */
export function icsCalendarName(icsContent: string): string | null {
  const match = icsContent.match(/^X-WR-CALNAME(?:;[^:]*)?:(.+)$/m)
  const name = match?.[1].trim().replace(/\\,/g, ',').replace(/\\;/g, ';')
  return name ? name.slice(0, 100) : null
}
