import { icsCalendarName, icsEventsToRows, parseICSFile } from '../ics'

const ICS = [
  'BEGIN:VCALENDAR',
  'X-WR-CALNAME:Oak Hill Elementary',
  'BEGIN:VEVENT',
  'UID:picture-day@oakhill',
  'SUMMARY:Picture day\\, grades K-2',
  'DTSTART;TZID=America/Chicago:20261002T090000',
  'DTEND;TZID=America/Chicago:20261002T103000',
  'DESCRIPTION:Wear the blue',
  '  shirt',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:no-school@oakhill',
  'SUMMARY:No school',
  'DTSTART;VALUE=DATE:20261012',
  'DTEND;VALUE=DATE:20261013',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:practice@team',
  'SUMMARY:Soccer practice',
  'DTSTART:20261006T230000Z',
  'RRULE:FREQ=WEEKLY;BYDAY=TU',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('parseICSFile', () => {
  const events = parseICSFile(ICS)

  it('reads every event, unescaping text and unfolding continued lines', () => {
    expect(events.map((e) => e.uid)).toEqual(['picture-day@oakhill', 'no-school@oakhill', 'practice@team'])
    expect(events[0].summary).toBe('Picture day, grades K-2')
    expect(events[0].description).toBe('Wear the blueshirt')
  })

  it('keeps the wall-clock time of a TZID event with its offset', () => {
    expect(events[0].start.dateTime).toBe('2026-10-02T09:00:00-05:00')
  })

  it('treats VALUE=DATE as all-day', () => {
    expect(events[1].start.date).toBe('2026-10-12')
    expect(events[1].start.dateTime).toBeUndefined()
  })
})

describe('icsEventsToRows', () => {
  const rows = icsEventsToRows(parseICSFile(ICS), { userId: 'u1', importId: 'imp1', bucket: 'Family' })

  it('maps to calendar_events rows owned by the importer', () => {
    expect(rows[0]).toMatchObject({
      user_id: 'u1', import_id: 'imp1', external_id: 'picture-day@oakhill', source: 'uploaded_calendar',
      start_date: '2026-10-02', hour_slot: 'hour-9AM', duration: 90, bucket: 'Family', all_day: false,
    })
    expect(rows[1]).toMatchObject({ start_date: '2026-10-12', all_day: true, hour_slot: null })
    expect(rows[2]).toMatchObject({ repeat_rule: 'weekly' })
  })
})

describe('icsCalendarName', () => {
  it('reads X-WR-CALNAME', () => expect(icsCalendarName(ICS)).toBe('Oak Hill Elementary'))
  it('is null without one', () => expect(icsCalendarName('BEGIN:VCALENDAR\r\nEND:VCALENDAR')).toBeNull())
})
