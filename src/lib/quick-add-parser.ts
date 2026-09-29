import { addDays, addWeeks, differenceInCalendarDays, format, nextDay, nextMonday, type Day } from 'date-fns'
import { dateStr } from '@/lib/date-utils'
import type { RepeatRule } from '@/types/tasks'

// Natural-language quick add, the way Todoist / TickTick / Things read it:
// "Call mom tomorrow 3pm for 30m #Family" → title "Call mom", tomorrow,
// 3 PM, 30 minutes, bucket Family. Pure and client-local (dates are YYYY-MM-DD
// keys from dateStr), so the preview chips and the created task always agree.

export type QuickAddMatchKind = 'date' | 'time' | 'duration' | 'repeat' | 'bucket'

export interface QuickAddResult {
  title: string
  dueDate: string | null
  /** Canonical `hour-3PM` / `hour-3:30PM` slot, or null when no time was given. */
  hourSlot: string | null
  /** Minutes. */
  duration: number | null
  repeat: RepeatRule | null
  bucket: string | null
  /** What was recognised, for a live preview. */
  matches: Array<{ kind: QuickAddMatchKind; label: string }>
}

const WEEKDAYS: Record<string, Day> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6,
}
const WEEKDAY_NAMES = 'sunday|monday|tuesday|wednesday|thursday|friday|saturday'
// Abbreviations collide with ordinary words ("sun cream", "wed" in a list),
// so they only count after a preposition: "on fri", "next tue".
const WEEKDAY_ABBR = 'sun|mon|tues?|weds?|thu(?:rs?)?|fri|sat'
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH_PATTERN =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
const SMALL_NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 }

function slotFor(hours: number, minutes: number): string {
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 === 0 ? 12 : hours % 12
  return `hour-${h}${minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ''}${suffix}`
}

function timeLabel(hours: number, minutes: number): string {
  const h = hours % 12 === 0 ? 12 : hours % 12
  return `${h}${minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ''} ${hours >= 12 ? 'PM' : 'AM'}`
}

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  return h ? `${h}h` : `${m}m`
}

export function dateLabel(key: string, now: Date): string {
  const date = new Date(`${key}T00:00:00`)
  const diff = differenceInCalendarDays(date, now)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1 && diff < 7) return format(date, 'EEEE')
  return format(date, date.getFullYear() === now.getFullYear() ? 'EEE, MMM d' : 'MMM d, yyyy')
}

const MATCH_ORDER: QuickAddMatchKind[] = ['date', 'time', 'duration', 'repeat', 'bucket']

const normalizeBucket = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, '')

export function parseQuickAdd(input: string, now: Date, buckets: string[] = []): QuickAddResult {
  let text = ` ${input} `
  const found: Array<{ kind: QuickAddMatchKind; label: string }> = []
  let dueDate: string | null = null
  let hourSlot: string | null = null
  let duration: number | null = null
  let repeat: RepeatRule | null = null
  let bucket: string | null = null

  // Cut a recognised phrase out of the text, keeping word boundaries intact.
  // Each pattern swallows its own lead word ("at", "for", "on"...), so a
  // title with nothing to parse is never trimmed ("Check in" stays whole).
  const cut = (m: RegExpMatchArray, result: { kind: QuickAddMatchKind; label: string }) => {
    found.push(result)
    text = `${text.slice(0, m.index)} ${text.slice((m.index ?? 0) + m[0].length)}`
  }
  const take = (pattern: RegExp, handle: (m: RegExpMatchArray) => { kind: QuickAddMatchKind; label: string } | null) => {
    const m = text.match(pattern)
    if (!m || m.index === undefined) return
    const result = handle(m)
    if (result) cut(m, result)
  }

  const today = dateStr(now)

  // #Bucket — the first tag that names a real bucket; other #tags stay in the title.
  const tagPattern = /\s#([^\s#]+)(?=\s)/g
  for (let tag = tagPattern.exec(text); tag; tag = tagPattern.exec(text)) {
    const wanted = normalizeBucket(tag[1])
    const match = buckets.find((b) => normalizeBucket(b) === wanted)
    if (match) {
      bucket = match
      cut(tag, { kind: 'bucket', label: match })
      break
    }
  }

  const setRepeat = (word: string) => {
    if (word === 'day' || word === 'daily') {
      repeat = 'daily'
      return { kind: 'repeat' as const, label: 'Every day' }
    }
    if (word === 'weekday' || word === 'weekdays') {
      repeat = 'weekdays'
      return { kind: 'repeat' as const, label: 'Every weekday' }
    }
    if (word === 'week' || word === 'weekly') {
      repeat = 'weekly'
      return { kind: 'repeat' as const, label: 'Every week' }
    }
    repeat = 'monthly'
    return { kind: 'repeat' as const, label: 'Every month' }
  }

  take(new RegExp(`\\severy\\s+(day|weekday|week|month|${WEEKDAY_NAMES}|${WEEKDAY_ABBR})(?=\\s)`, 'i'), (m) => {
    const word = m[1].toLowerCase()
    if (!(word in WEEKDAYS)) return setRepeat(word)
    // "every friday" — weekly, anchored on the next Friday (today counts).
    const day = WEEKDAYS[word]
    repeat = 'weekly'
    dueDate = now.getDay() === day ? today : dateStr(nextDay(now, day))
    return { kind: 'repeat', label: `Every ${format(nextDay(now, day), 'EEEE')}` }
  })

  // "for 30m", "for 2 hours", "for 1h15m" (Todoist's documented forms).
  take(/\sfor\s+(?=\d)(?:(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?))?\s*(?:(\d+)\s*(?:m|mins?|minutes?))?(?=\s)/i, (m) => {
    const minutes = Math.round(Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0))
    if (!minutes || minutes > 24 * 60) return null
    duration = minutes
    return { kind: 'duration', label: durationLabel(minutes) }
  })

  // noon/midnight only after "at" — "Watch Midnight Mass" is a title.
  take(/\s(?:(?:at\s+|@\s*)(noon|midnight)|(?:at\s+|@\s*)?(?:(\d{1,2})(?::(\d{2}))?\s*(am|pm)|(\d{1,2}):(\d{2})))(?=\s)/i, (m) => {
    let hours: number
    let minutes = 0
    if (m[1]) {
      hours = m[1].toLowerCase() === 'noon' ? 12 : 0
    } else if (m[4]) {
      hours = Number(m[2]) % 12 + (m[4].toLowerCase() === 'pm' ? 12 : 0)
      minutes = m[3] ? Number(m[3]) : 0
      if (Number(m[2]) > 12) return null
    } else {
      hours = Number(m[5])
      minutes = Number(m[6])
    }
    if (hours > 23 || minutes > 59) return null
    hourSlot = slotFor(hours, minutes)
    return { kind: 'time', label: timeLabel(hours, minutes) }
  })

  if (!dueDate) {
    const setDate = (key: string) => {
      dueDate = key
      return { kind: 'date' as const, label: dateLabel(key, now) }
    }
    const lead = '(?:(?:on|by|due|for)\\s+)?'
    // A month/day without a year means the next time that date comes round.
    const monthDay = (month: number, day: number) => {
      if (month < 0 || month > 11 || day < 1 || day > 31) return null
      let candidate = new Date(now.getFullYear(), month, day)
      if (candidate.getMonth() !== month) return null
      if (dateStr(candidate) < today) candidate = new Date(now.getFullYear() + 1, month, day)
      // Feb 29 after a leap day rolls into a year without one.
      if (candidate.getMonth() !== month) return null
      return setDate(dateStr(candidate))
    }
    const attempts: Array<[RegExp, (m: RegExpMatchArray) => { kind: QuickAddMatchKind; label: string } | null]> = [
      [new RegExp(`\\s${lead}(today|tod|tonight|tomorrow|tmrw?|tmr)(?=\\s)`, 'i'), (m) =>
        setDate(/^to(day|d|night)$/i.test(m[1]) ? today : dateStr(addDays(now, 1)))],
      [/\s(?:(this|next)\s+)?weekend(?=\s)/i, (m) => {
        // This weekend's Saturday (yesterday, when today is Sunday).
        const saturday = now.getDay() === 6 ? now : now.getDay() === 0 ? addDays(now, -1) : nextDay(now, 6)
        if (m[1]?.toLowerCase() === 'next') return setDate(dateStr(addDays(saturday, 7)))
        return setDate(now.getDay() === 0 ? today : dateStr(saturday))
      }],
      [/\snext\s+week(?=\s)/i, () => setDate(dateStr(nextMonday(now)))],
      [/\sin\s+(\d+|an?|one|two|three|four|five)\s+(days?|weeks?)(?=\s)/i, (m) => {
        const n = SMALL_NUMBERS[m[1].toLowerCase()] ?? Number(m[1])
        if (!n || n > 365) return null
        return setDate(dateStr(m[2].toLowerCase().startsWith('w') ? addWeeks(now, n) : addDays(now, n)))
      }],
      [new RegExp(`\\s(?:(?:on|by|due|for|next|this)\\s+(${WEEKDAY_NAMES}|${WEEKDAY_ABBR})|(${WEEKDAY_NAMES}))(?=\\s)`, 'i'), (m) =>
        setDate(dateStr(nextDay(now, WEEKDAYS[(m[1] ?? m[2]).toLowerCase()])))],
      [new RegExp(`\\s${lead}(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?=\\s)`, 'i'), (m) =>
        monthDay(MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), Number(m[2]))],
      // "4/15" needs a lead word or to end the entry — "Take 1/2 pill" is a dose.
      [/\s(?:(?:on|by|due|for)\s+(\d{1,2})\/(\d{1,2})(?=\s)|(\d{1,2})\/(\d{1,2})(?=\s*$))/, (m) =>
        monthDay(Number(m[1] ?? m[3]) - 1, Number(m[2] ?? m[4]))],
    ]
    for (const [pattern, handle] of attempts) {
      take(pattern, handle)
      if (dueDate) break
    }
  }

  // Bare "daily" / "weekly" count only as the last word ("Pay rent monthly"),
  // after times and dates are cut — "Submit weekly report" is a title.
  if (!repeat) take(/\s(daily|weekdays|weekly|monthly)\s*$/i, (m) => setRepeat(m[1].toLowerCase()))

  // A repeat with no anchor day starts today.
  if (repeat && !dueDate) dueDate = today

  const title = text.replace(/\s+/g, ' ').trim()

  // Nothing but schedule words ("tomorrow") — keep the text as the title.
  if (!title) {
    return { title: input.trim(), dueDate: null, hourSlot: null, duration: null, repeat: null, bucket: null, matches: [] }
  }

  return {
    title,
    dueDate,
    hourSlot,
    duration,
    repeat,
    bucket,
    matches: found.sort((a, b) => MATCH_ORDER.indexOf(a.kind) - MATCH_ORDER.indexOf(b.kind)),
  }
}
