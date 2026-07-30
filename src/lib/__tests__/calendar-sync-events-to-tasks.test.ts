/**
 * @jest-environment node
 */
import { syncEventsToTasks, MissingTasksTableError, type CalendarEventRow } from '../calendar-sync'

type Query = { table: string; op: 'insert' | 'update'; payload: any }

type Responder = (q: Query) => { data?: any; error?: any }

/**
 * Minimal PostgREST-shaped fake. Every terminal call (`.single()` or awaiting the
 * builder) goes through `run`, which records the query, tracks how many are in
 * flight at once, and resolves on a macrotask so overlapping calls are visible.
 */
function makeSupabase(respond: Responder) {
  const queries: Query[] = []
  let inFlight = 0
  let maxInFlight = 0

  const run = async (q: Query) => {
    queries.push(q)
    inFlight++
    maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise((resolve) => setTimeout(resolve, 5))
    inFlight--
    const result = respond(q)
    return { data: result.data ?? null, error: result.error ?? null }
  }

  const builder = (q: Query): any => ({
    select: () => builder(q),
    eq: () => builder(q),
    single: () => run(q),
    then: (onFulfilled: any, onRejected: any) => run(q).then(onFulfilled, onRejected),
  })

  const supabase = {
    from: (table: string) => ({
      insert: (payload: any) => builder({ table, op: 'insert', payload }),
      update: (payload: any) => builder({ table, op: 'update', payload }),
    }),
  }

  return {
    supabase: supabase as any,
    queries,
    get maxInFlight() {
      return maxInFlight
    },
  }
}

function event(overrides: Partial<CalendarEventRow> & { id: string }): CalendarEventRow {
  return {
    import_id: 'import-1',
    title: 'Standup',
    content: null,
    start_time: '2026-07-29T09:00:00.000Z',
    start_date: '2026-07-29',
    end_time: '2026-07-29T09:30:00.000Z',
    end_date: '2026-07-29',
    all_day: false,
    rrule: null,
    repeat_rule: null,
    due_date: '2026-07-29',
    hour_slot: '9am',
    bucket: 'Work',
    duration: 30,
    completed: false,
    position: null,
    task_id: null,
    ...overrides,
  }
}

// A created/updated task row echoing back what the route wrote.
const taskRow = (id: string, payload: any) => ({
  id,
  content: payload.content ?? 'Standup',
  due_date: payload.due_date ?? null,
  start_date: payload.start_date ?? null,
  end_date: payload.end_date ?? null,
  hour_slot: payload.hour_slot ?? null,
  end_hour_slot: payload.end_hour_slot ?? null,
  duration: payload.duration ?? null,
  repeat_rule: payload.repeat_rule ?? null,
  bucket: payload.bucket ?? null,
  completed: payload.completed ?? false,
  position: payload.position ?? null,
  all_day: payload.all_day ?? false,
})

describe('syncEventsToTasks', () => {
  let errorSpy: jest.SpyInstance

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  it('creates a task per unlinked event and links it back onto the event', async () => {
    let n = 0
    const { supabase, queries } = makeSupabase((q) => {
      if (q.table === 'lifeboard_tasks') return { data: taskRow(`task-${++n}`, q.payload[0]) }
      return {}
    })

    const events = [event({ id: 'evt-1' }), event({ id: 'evt-2' }), event({ id: 'evt-3' })]
    const result = await syncEventsToTasks(supabase, 'user-1', events)

    expect(result).toEqual({ created: 3, updated: 0, errors: 0 })

    const inserts = queries.filter((q) => q.table === 'lifeboard_tasks')
    expect(inserts).toHaveLength(3)
    expect(inserts[0].payload[0]).toMatchObject({ user_id: 'user-1', content: 'Standup', due_date: '2026-07-29' })

    // Every event got its task_id written back, both in the DB payload and in place
    const links = queries.filter((q) => q.table === 'calendar_events')
    expect(links).toHaveLength(3)
    expect(links.map((q) => q.payload.task_id).sort()).toEqual(['task-1', 'task-2', 'task-3'])
    expect(events.map((e) => e.task_id).sort()).toEqual(['task-1', 'task-2', 'task-3'])
  })

  it('overlaps round trips across events instead of running one event at a time', async () => {
    let n = 0
    const harness = makeSupabase((q) => {
      if (q.table === 'lifeboard_tasks') return { data: taskRow(`task-${++n}`, q.payload[0]) }
      return {}
    })

    const events = Array.from({ length: 6 }, (_, i) => event({ id: `evt-${i}` }))
    const result = await syncEventsToTasks(harness.supabase, 'user-1', events)

    expect(result.created).toBe(6)
    // Serial per-event processing would never exceed 1 request in flight.
    expect(harness.maxInFlight).toBeGreaterThan(1)
  })

  it('skips events with a blank title without touching the database', async () => {
    const { supabase, queries } = makeSupabase(() => ({}))

    const result = await syncEventsToTasks(supabase, 'user-1', [
      event({ id: 'evt-1', title: '   ', content: null }),
      event({ id: 'evt-2', title: null, content: '' }),
    ])

    expect(result).toEqual({ created: 0, updated: 0, errors: 0 })
    expect(queries).toHaveLength(0)
  })

  it('counts one failing event as an error and still processes the others', async () => {
    let n = 0
    const { supabase } = makeSupabase((q) => {
      if (q.table === 'lifeboard_tasks') {
        if (q.payload[0].content === 'Bad event') return { error: { code: '23502', message: 'null value' } }
        return { data: taskRow(`task-${++n}`, q.payload[0]) }
      }
      return {}
    })

    const result = await syncEventsToTasks(supabase, 'user-1', [
      event({ id: 'evt-1' }),
      event({ id: 'evt-2', title: 'Bad event' }),
      event({ id: 'evt-3' }),
    ])

    expect(result).toEqual({ created: 2, updated: 0, errors: 1 })
  })

  it('throws MissingTasksTableError when the tasks table is absent', async () => {
    const { supabase } = makeSupabase(() => ({ error: { code: '42P01', message: 'relation does not exist' } }))

    await expect(syncEventsToTasks(supabase, 'user-1', [event({ id: 'evt-1' })])).rejects.toThrow(
      MissingTasksTableError,
    )
  })

  it('updates an already-linked task and still counts it when the mirror write fails', async () => {
    const { supabase, queries } = makeSupabase((q) => {
      if (q.table === 'lifeboard_tasks') return { data: taskRow('task-9', q.payload) }
      return { error: { code: 'PGRST116', message: 'mirror failed' } }
    })

    const result = await syncEventsToTasks(supabase, 'user-1', [event({ id: 'evt-1', task_id: 'task-9' })])

    expect(result).toEqual({ created: 0, updated: 1, errors: 0 })
    // The task was updated, not inserted
    expect(queries.filter((q) => q.table === 'lifeboard_tasks')[0].op).toBe('update')
    // A failed mirror write is logged, not fatal
    expect(errorSpy).toHaveBeenCalled()
  })
})
