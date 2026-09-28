/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '../route'

const supabaseMockInstance = {
  auth: {
    getUser: jest.fn(),
    getSession: jest.fn(async () => ({ data: { session: null } })),
  },
}

const messagesGet = jest.fn()
const getGmailForUser = jest.fn()
const runGemini = jest.fn()

jest.mock('@/utils/supabase/server', () => ({
  supabaseServer: jest.fn(() => supabaseMockInstance),
}))

jest.mock('@/lib/rate-limit', () => ({
  chatLimiter: { check: jest.fn(() => null) },
  getRateLimitKey: jest.fn(() => 'user:test'),
}))

jest.mock('@/lib/gmail/client', () => ({
  getGmailForUser: (...args: unknown[]) => getGmailForUser(...args),
}))

jest.mock('@/lib/gmail/message-parser', () => ({
  parseGmailMessage: (data: { subject: string }) => ({
    from: 'school@example.com',
    subject: data.subject,
    date: 'Mon, 28 Sep 2026',
    textBody: 'Picture day is this Friday at 9am.',
    snippet: '',
  }),
}))

jest.mock('@/lib/replicate/client', () => ({
  runGemini: (...args: unknown[]) => runGemini(...args),
}))

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/email/ai/extract-tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const signedIn = () =>
  supabaseMockInstance.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

describe('POST /api/email/ai/extract-tasks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getGmailForUser.mockResolvedValue({ users: { messages: { get: messagesGet } } })
    messagesGet.mockResolvedValue({ data: { subject: 'Picture day' } })
  })

  it('returns 401 when not signed in', async () => {
    supabaseMockInstance.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeRequest({ messageIds: ['m1'], today: '2026-09-28' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when the client omits its local date', async () => {
    signedIn()
    const res = await POST(makeRequest({ messageIds: ['m1'] }))
    expect(res.status).toBe(400)
    expect(runGemini).not.toHaveBeenCalled()
  })

  it('returns 400 for an empty message list', async () => {
    signedIn()
    const res = await POST(makeRequest({ messageIds: [], today: '2026-09-28' }))
    expect(res.status).toBe(400)
  })

  it('prompts with the client date and drops low-confidence items', async () => {
    signedIn()
    runGemini.mockResolvedValue(
      JSON.stringify([
        { title: 'Send picture day form', description: '', dueDate: '2026-10-02', dueTime: '09:00', location: null, suggestedBucket: null, sourceEmailSubject: 'Picture day', confidence: 0.9 },
        { title: 'Maybe read newsletter', description: '', dueDate: null, dueTime: null, location: null, suggestedBucket: null, sourceEmailSubject: 'Picture day', confidence: 0.2 },
      ])
    )

    const res = await POST(makeRequest({ messageIds: ['m1'], today: '2026-09-28', buckets: ['Family'] }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.tasks.map((t: { title: string }) => t.title)).toEqual(['Send picture day form'])
    expect(body.totalScanned).toBe(1)
    const systemPrompt = runGemini.mock.calls[0][0].messages[0].content as string
    expect(systemPrompt).toContain("Today's date is 2026-09-28.")
    expect(systemPrompt).toContain('"Family"')
  })
})
