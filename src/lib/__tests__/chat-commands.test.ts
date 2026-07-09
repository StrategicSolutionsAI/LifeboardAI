/**
 * @jest-environment node
 */
import { displayableStreamPrefix, finalizeStreamedText, matchByName } from '@/lib/chat-commands'

const OPEN = '[LIFEBOARD_CMD]'
const CLOSE = '[/LIFEBOARD_CMD]'
const BLOCK = `${OPEN}{"action":"create_task","content":"Buy milk"}${CLOSE}`

describe('displayableStreamPrefix', () => {
  it('passes through plain text unchanged', () => {
    expect(displayableStreamPrefix('Sure, adding that now.')).toBe('Sure, adding that now.')
  })

  it('removes a completed command block, keeping surrounding prose', () => {
    expect(displayableStreamPrefix(`Done! ${BLOCK} Anything else?`)).toBe('Done!  Anything else?')
  })

  it('holds back an unclosed command block still being emitted', () => {
    expect(displayableStreamPrefix(`Done! ${OPEN}{"action":"create`)).toBe('Done! ')
  })

  it('holds back a trailing partial opening marker so it never flashes', () => {
    // "[LIFEBOA" is a prefix of the open marker — must not be shown yet
    expect(displayableStreamPrefix('Done! [LIFEBOA')).toBe('Done! ')
    expect(displayableStreamPrefix('Cost is [')).toBe('Cost is ')
  })

  it('shows a bracket that turns out to be prose, not a marker', () => {
    // Next token proves "[x" cannot become the open marker
    expect(displayableStreamPrefix('See note [x')).toBe('See note [x')
  })

  it('grows monotonically as raw is streamed token by token', () => {
    const full = `Hi there ${BLOCK} bye`
    let prev = ''
    for (let n = 1; n <= full.length; n++) {
      const cur = displayableStreamPrefix(full.slice(0, n))
      expect(cur.startsWith(prev)).toBe(true) // never un-emits
      prev = cur
    }
    expect(prev).toBe('Hi there  bye')
  })
})

describe('finalizeStreamedText', () => {
  it('leaves a normally-completed reply untouched (including trailing prose bracket)', () => {
    expect(finalizeStreamedText('All set, see item [1]')).toBe('All set, see item [1]')
  })

  it('drops a dangling unclosed command block from a mid-stream failure', () => {
    expect(finalizeStreamedText(`Working on it ${OPEN}{"action":"crea`)).toBe('Working on it')
  })

  it('drops a trailing partial opening marker from a mid-stream failure', () => {
    expect(finalizeStreamedText('Working on it [LIFEBOARD_C')).toBe('Working on it')
  })

  it('keeps completed blocks intact for command execution', () => {
    expect(finalizeStreamedText(`Done ${BLOCK}`)).toBe(`Done ${BLOCK}`)
  })
})

describe('matchByName', () => {
  const tasks = [
    { id: '1', content: 'Call the dentist' },
    { id: '2', content: 'Buy groceries' },
    { id: '3', content: 'Call mom about dinner' },
  ]

  it('returns null when nothing matches', () => {
    expect(matchByName(tasks, 'file taxes', 'content')).toBeNull()
    expect(matchByName(tasks, '  ', 'content')).toBeNull()
  })

  it('flags an exact match as strong', () => {
    const m = matchByName(tasks, 'Buy groceries', 'content')
    expect(m).toMatchObject({ item: { id: '2' }, strong: true })
  })

  it('flags a substring (item contains needle) match as strong', () => {
    const m = matchByName(tasks, 'dentist', 'content')
    expect(m).toMatchObject({ item: { id: '1' }, strong: true })
  })

  it('flags a reverse (needle contains item) match as strong', () => {
    const m = matchByName(tasks, 'please buy groceries today', 'content')
    expect(m).toMatchObject({ item: { id: '2' }, strong: true })
  })

  it('flags a fuzzy word-overlap match as weak — the case that must be confirmed', () => {
    // "call dad" shares only the word "call" with two tasks: a dangerous guess
    const m = matchByName(tasks, 'call dad', 'content')
    expect(m).not.toBeNull()
    expect(m!.strong).toBe(false)
  })
})
