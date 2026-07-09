/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../route'

const supabaseMockInstance = {
  auth: {
    getUser: jest.fn(),
    // No session → getUserCached always falls through to getUser
    getSession: jest.fn(async () => ({ data: { session: null } })),
  },
}

const checkRateLimit = jest.fn()
const getRateLimitKey = jest.fn()
const executeCommand = jest.fn()
const buildChatContext = jest.fn()

jest.mock('@/utils/supabase/server', () => ({
  supabaseServer: jest.fn(() => supabaseMockInstance),
}))

jest.mock('@/lib/rate-limit', () => ({
  apiLimiter: {
    check: (...args: unknown[]) => checkRateLimit(...args),
  },
  getRateLimitKey: (...args: unknown[]) => getRateLimitKey(...args),
}))

jest.mock('@/lib/chat-commands', () => ({
  executeCommand: (...args: unknown[]) => executeCommand(...args),
}))

jest.mock('@/lib/chat-context', () => ({
  buildChatContext: (...args: unknown[]) => buildChatContext(...args),
}))

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/chat/execute-command', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('/api/chat/execute-command', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    checkRateLimit.mockReturnValue(null)
    getRateLimitKey.mockReturnValue('user:test-user-id')
  })

  it('returns 401 when the caller is not authenticated', async () => {
    supabaseMockInstance.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const response = await POST(makeRequest({ action: 'create_task', content: 'Call John' }))
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Not authenticated')
    expect(executeCommand).not.toHaveBeenCalled()
  })

  it('returns 400 for a body that fails validation', async () => {
    supabaseMockInstance.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    })

    const response = await POST(makeRequest({ action: 'create_task' })) // missing content
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
    expect(executeCommand).not.toHaveBeenCalled()
  })

  it('returns 400 for an unknown action', async () => {
    supabaseMockInstance.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    })

    const response = await POST(makeRequest({ action: 'drop_database' }))

    expect(response.status).toBe(400)
    expect(executeCommand).not.toHaveBeenCalled()
  })

  it('executes a valid command and returns its result', async () => {
    supabaseMockInstance.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    })
    executeCommand.mockResolvedValue({ success: true, message: 'Task created: Call John' })

    const body = { action: 'create_task', content: 'Call John', due_date: '2026-07-10', hour_slot: 15 }
    const request = makeRequest(body)
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true, message: 'Task created: Call John' })
    expect(executeCommand).toHaveBeenCalledWith(
      body,
      expect.objectContaining({ userId: 'test-user-id', supabase: supabaseMockInstance })
    )
    expect(getRateLimitKey).toHaveBeenCalledWith(request, 'test-user-id')
    expect(checkRateLimit).toHaveBeenCalledWith('user:test-user-id')
  })

  it('answers refresh_context with dashboard state instead of executing a command', async () => {
    supabaseMockInstance.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    })
    buildChatContext.mockResolvedValue({ systemContext: 'Tasks: call John', userId: 'test-user-id' })

    const response = await POST(makeRequest({ action: 'refresh_context' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true, message: 'Tasks: call John' })
    expect(executeCommand).not.toHaveBeenCalled()
  })

  it('returns 429 when the caller exceeds the rate limit', async () => {
    supabaseMockInstance.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    })
    checkRateLimit.mockReturnValue(
      NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    )

    const response = await POST(makeRequest({ action: 'create_task', content: 'Call John' }))

    expect(response.status).toBe(429)
    expect(executeCommand).not.toHaveBeenCalled()
  })
})
