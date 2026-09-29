import { buildTodayPlan, nextOccurrence, type ExceptionIndex } from '../today-plan'
import type { Task, TaskOccurrenceException } from '@/types/tasks'

process.env.TZ = 'America/Chicago'

const TODAY = '2026-09-28' // a Monday, after the spring DST change
let n = 0
const task = (over: Partial<Task>): Task => ({ id: `t${++n}`, content: `task ${n}`, completed: false, ...over }) as Task
const due = (date: string) => ({ due: { date }, startDate: date, endDate: date })
const ids = (list: Task[]) => list.map((t) => t.content)

describe('buildTodayPlan', () => {
  it('splits today into day parts by start time and keeps untimed tasks as anytime', () => {
    const plan = buildTodayPlan([
      task({ content: 'dinner', ...due(TODAY), hourSlot: 'hour-6:30PM' }),
      task({ content: 'standup', ...due(TODAY), hourSlot: 'hour-9AM' }),
      task({ content: 'early', ...due(TODAY), hourSlot: 'hour-7AM' }),
      task({ content: 'pickup', ...due(TODAY), hourSlot: 'hour-3PM' }),
      task({ content: 'laundry', ...due(TODAY) }),
    ], TODAY)
    expect(ids(plan.timed.morning)).toEqual(['early', 'standup'])
    expect(ids(plan.timed.afternoon)).toEqual(['pickup'])
    expect(ids(plan.timed.evening)).toEqual(['dinner'])
    expect(ids(plan.anytime)).toEqual(['laundry'])
    expect(plan.openCount).toBe(5)
  })

  it('keeps overdue work out of today, oldest first, but treats a running multi-day task as today', () => {
    const plan = buildTodayPlan([
      task({ content: 'late2', ...due('2026-09-25') }),
      task({ content: 'late1', ...due('2026-09-01') }),
      task({ content: 'trip', due: { date: '2026-09-26' }, startDate: '2026-09-26', endDate: '2026-09-30' }),
    ], TODAY)
    expect(ids(plan.overdue)).toEqual(['late1', 'late2'])
    expect(ids(plan.anytime)).toEqual(['trip'])
  })

  it('shows a weekly task on its weekday after the spring DST change', () => {
    // Started Monday Jan 5 (standard time); today is a Monday in daylight time.
    const plan = buildTodayPlan([task({ content: 'bins', ...due('2026-01-05'), repeatRule: 'weekly' })], TODAY)
    expect(ids(plan.anytime)).toEqual(['bins'])
  })

  it('never lists a repeating task as overdue, and hides it on days it does not repeat', () => {
    const plan = buildTodayPlan([
      task({ content: 'vitamins', ...due('2026-09-01'), repeatRule: 'daily' }),
      task({ content: 'friday', ...due('2026-09-04'), repeatRule: 'weekly' }),
    ], TODAY)
    expect(ids(plan.anytime)).toEqual(['vitamins'])
    expect(plan.overdue).toEqual([])
  })

  it('counts a repeating task done for today when its occurrence is skipped, and applies overrides', () => {
    const vitamins = task({ content: 'vitamins', ...due('2026-09-01'), repeatRule: 'daily' })
    const walk = task({ content: 'walk', ...due('2026-09-01'), repeatRule: 'daily', hourSlot: 'hour-7AM' })
    const exception = (taskId: string, over: Partial<TaskOccurrenceException>): TaskOccurrenceException =>
      ({ id: taskId, taskId, occurrenceDate: TODAY, skip: false, ...over })
    const index: ExceptionIndex = new Map([
      [vitamins.id, new Map([[TODAY, exception(vitamins.id, { skip: true })]])],
      [walk.id, new Map([[TODAY, exception(walk.id, { overrideHourSlot: 'hour-6PM' })]])],
    ])
    const plan = buildTodayPlan([vitamins, walk], TODAY, index)
    expect(ids(plan.done)).toEqual(['vitamins'])
    expect(ids(plan.timed.evening)).toEqual(['walk'])
    expect(plan.timed.morning).toEqual([])
  })

  it('treats a Todoist repeat it cannot expand as never late and never a suggestion', () => {
    const plan = buildTodayPlan([
      task({ content: 'biweekly-late', ...due('2026-09-20'), due: { date: '2026-09-20', is_recurring: true } }),
      task({ content: 'biweekly-next', ...due('2026-10-01'), due: { date: '2026-10-01', is_recurring: true } }),
    ], TODAY)
    expect(ids(plan.anytime)).toEqual(['biweekly-late'])
    expect(plan.overdue).toEqual([])
    expect(plan.suggestions.thisWeek).toEqual([])
  })

  it('plans another day without carrying anything over into it', () => {
    const plan = buildTodayPlan([
      task({ content: 'late', ...due('2026-09-20') }),
      task({ content: 'on-day', ...due('2026-10-02') }),
      task({ content: 'todoist-repeat', ...due('2026-09-20'), due: { date: '2026-09-20', is_recurring: true } }),
      task({ content: 'weekly-fri', ...due('2026-09-04'), repeatRule: 'weekly' }),
    ], '2026-10-02', new Map(), TODAY)
    expect(plan.overdue).toEqual([])
    expect(ids(plan.anytime)).toEqual(['on-day', 'weekly-fri'])
  })

  it('lists tasks finished today, whether due today or completed today', () => {
    const plan = buildTodayPlan([
      task({ content: 'due-today', ...due(TODAY), completed: true, updated_at: '2026-09-20T12:00:00Z' }),
      task({ content: 'done-now', ...due('2026-09-01'), completed: true, updated_at: '2026-09-28T15:00:00Z' }),
      task({ content: 'old', ...due('2026-09-01'), completed: true, updated_at: '2026-09-02T15:00:00Z' }),
    ], TODAY)
    expect(ids(plan.done)).toEqual(['done-now', 'due-today'])
  })

  it('suggests tomorrow, the rest of the week and undated tasks, newest undated first', () => {
    const plan = buildTodayPlan([
      task({ content: 'tmr', ...due('2026-09-29') }),
      task({ content: 'fri', ...due('2026-10-02') }),
      task({ content: 'far', ...due('2026-11-02') }),
      task({ content: 'old-idea', created_at: '2026-09-01T00:00:00Z' }),
      task({ content: 'new-idea', created_at: '2026-09-27T00:00:00Z' }),
    ], TODAY)
    expect(ids(plan.suggestions.tomorrow)).toEqual(['tmr'])
    expect(ids(plan.suggestions.thisWeek)).toEqual(['fri'])
    expect(ids(plan.suggestions.someday)).toEqual(['new-idea', 'old-idea'])
  })

  it('totals planned time and flags a heavy day', () => {
    const light = buildTodayPlan([
      task({ ...due(TODAY), hourSlot: 'hour-9AM' }), // timed, no length → 60
      task({ ...due(TODAY), duration: 30 }), // untimed with a length
      task({ ...due(TODAY) }), // no time, no length → not counted
    ], TODAY)
    expect(light.plannedMinutes).toBe(90)
    expect(light.heavy).toBe(false)
    const heavy = buildTodayPlan([task({ ...due(TODAY), hourSlot: 'hour-8AM', duration: 8 * 60 })], TODAY)
    expect(heavy.heavy).toBe(true)
  })
})

describe('nextOccurrence', () => {
  const skip = (taskId: string, day: string): TaskOccurrenceException => ({ id: `${taskId}-${day}`, taskId, occurrenceDate: day, skip: true })

  it('finds the next day a repeating task falls on, today included', () => {
    const weekly = task({ ...due('2026-01-07'), repeatRule: 'weekly' }) // Wednesdays
    expect(nextOccurrence(weekly, TODAY)).toBe('2026-09-30')
    const daily = task({ ...due('2026-09-01'), repeatRule: 'daily' })
    expect(nextOccurrence(daily, TODAY)).toBe(TODAY)
  })

  it('skips days already finished or skipped', () => {
    const daily = task({ ...due('2026-09-01'), repeatRule: 'daily' })
    const index: ExceptionIndex = new Map([[daily.id, new Map([[TODAY, skip(daily.id, TODAY)]])]])
    expect(nextOccurrence(daily, TODAY, index)).toBe('2026-09-29')
  })

  it('returns null when the series has ended or the task has no anchor date', () => {
    const ended = task({ due: { date: '2026-09-01' }, startDate: '2026-09-01', endDate: '2026-09-20', repeatRule: 'daily' })
    expect(nextOccurrence(ended, TODAY)).toBeNull()
    expect(nextOccurrence(task({ repeatRule: 'daily' }), TODAY)).toBeNull()
  })
})
