import {
  COMMAND_CATALOG,
  executeCommandSchema,
  isMutatingAction,
  REALTIME_TOOLS,
} from '../chat-command-catalog'
import { getCommandsPrompt } from '../chat-commands'

describe('chat-command-catalog', () => {
  const catalogNames = COMMAND_CATALOG.map(c => c.name)

  it('has unique command names and exactly one read-only command', () => {
    expect(new Set(catalogNames).size).toBe(catalogNames.length)
    const readOnly = COMMAND_CATALOG.filter(c => !c.mutates).map(c => c.name)
    expect(readOnly).toEqual(['refresh_context'])
  })

  it('executeCommandSchema covers exactly the catalog actions', () => {
    const unionActions = executeCommandSchema.options.map(
      option => option.shape.action.value
    )
    expect(unionActions.sort()).toEqual([...catalogNames].sort())
  })

  it('validates commands with the same semantics as before the catalog', () => {
    expect(
      executeCommandSchema.safeParse({
        action: 'create_task',
        content: 'Call John',
        due_date: '2026-07-13',
        hour_slot: 15,
      }).success
    ).toBe(true)
    expect(executeCommandSchema.safeParse({ action: 'refresh_context' }).success).toBe(true)
    // Unknown action
    expect(executeCommandSchema.safeParse({ action: 'search_tasks' }).success).toBe(false)
    // Malformed date
    expect(
      executeCommandSchema.safeParse({ action: 'create_task', content: 'x', due_date: 'tomorrow' }).success
    ).toBe(false)
    // Hour out of range
    expect(
      executeCommandSchema.safeParse({ action: 'create_task', content: 'x', hour_slot: 24 }).success
    ).toBe(false)
    // Missing required field
    expect(
      executeCommandSchema.safeParse({ action: 'reschedule_task', task_name: 'x' }).success
    ).toBe(false)
  })

  it('generates one realtime tool per catalog entry, in order', () => {
    expect(REALTIME_TOOLS.map(t => t.name)).toEqual(catalogNames)
    for (const tool of REALTIME_TOOLS) {
      expect(tool.type).toBe('function')
      expect(tool.description.length).toBeGreaterThan(0)
      expect(tool.parameters.type).toBe('object')
      // OpenAI expects bare JSON Schema — the $schema key must be stripped
      expect(tool.parameters).not.toHaveProperty('$schema')
    }
  })

  it('generates full JSON Schema parameters (create_task)', () => {
    const createTask = REALTIME_TOOLS.find(t => t.name === 'create_task')!
    expect(createTask.parameters).toEqual({
      type: 'object',
      properties: {
        content: {
          type: 'string',
          minLength: 1,
          maxLength: 500,
          description: 'The task text, without the word "task"',
        },
        due_date: {
          type: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          description: 'Due date as YYYY-MM-DD, if the user gave one',
        },
        hour_slot: {
          type: 'integer',
          minimum: 0,
          maximum: 23,
          description: 'Hour of day 0-23 if a time was given (e.g. 3pm = 15)',
        },
        bucket: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          description: 'Bucket/category name if clearly implied (e.g. Work, Personal, Household)',
        },
      },
      required: ['content'],
      additionalProperties: false,
    })
  })

  it('keeps the typed-chat prompt in lockstep with the catalog', () => {
    const prompt = getCommandsPrompt('2026-01-01', '2026')
    // Every mutating command is offered to the typed-chat model...
    for (const cmd of COMMAND_CATALOG.filter(c => c.mutates)) {
      expect(prompt).toContain(`"action":"${cmd.name}"`)
    }
    // ...refresh_context is realtime-only (typed chat rebuilds context per turn)
    expect(prompt).not.toContain('refresh_context')
    // ...and the prompt offers nothing outside the catalog
    const actionRe = /"action":"(\w+)"/g
    let match: RegExpExecArray | null
    while ((match = actionRe.exec(prompt)) !== null) {
      expect(catalogNames).toContain(match[1])
    }
  })

  it('declares mutation effects from the catalog', () => {
    expect(isMutatingAction('create_task')).toBe(true)
    expect(isMutatingAction('refresh_context')).toBe(false)
    expect(isMutatingAction('nonexistent')).toBe(false)
  })
})
