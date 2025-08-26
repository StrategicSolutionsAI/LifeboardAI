/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET, POST } from '../route'

// Dynamic delegates used by the chain mocks
let currentSelectSingle: jest.Mock<any, any> = jest.fn()
let currentUpsertSingle: jest.Mock<any, any> = jest.fn()

// Stable chain objects
const selectChain = {
  eq: jest.fn(() => ({
    single: (...args: any[]) => currentSelectSingle(...args),
  })),
}

const upsertChain = {
  select: jest.fn(() => ({
    single: (...args: any[]) => currentUpsertSingle(...args),
  })),
}

// Stable mock instance
const supabaseMockInstance = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => selectChain),
    upsert: jest.fn(() => upsertChain),
  })),
}

// Mock supabase server to always return the same instance
jest.mock('@/utils/supabase/server', () => ({
  supabaseServer: jest.fn(() => supabaseMockInstance),
}))

describe('/api/user/preferences', () => {
  const mockSupabase = supabaseMockInstance

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset delegates to no-op resolved values by default
    currentSelectSingle = jest.fn().mockResolvedValue({ data: null, error: null })
    currentUpsertSingle = jest.fn().mockResolvedValue({ data: null, error: null })
  })

  describe('GET', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const request = new NextRequest('http://localhost:3000/api/user/preferences')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('returns default preferences when user has no saved preferences', async () => {
      const mockUser = { id: 'test-user-id' }
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } })
      
      // Not found case
      currentSelectSingle = jest.fn().mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' },
      })

      const request = new NextRequest('http://localhost:3000/api/user/preferences')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        life_buckets: [],
        widgets_by_bucket: {}
      })
    })

    it('returns saved preferences when they exist', async () => {
      const mockUser = { id: 'test-user-id' }
      const mockPreferences = {
        life_buckets: ['Work', 'Personal'],
        widgets_by_bucket: { Work: ['tasks'] }
      }

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } })
      
      currentSelectSingle = jest.fn().mockResolvedValue({ 
        data: mockPreferences, 
        error: null,
      })

      const request = new NextRequest('http://localhost:3000/api/user/preferences')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockPreferences)
    })
  })

  describe('POST', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const request = new NextRequest('http://localhost:3000/api/user/preferences', {
        method: 'POST',
        body: JSON.stringify({ life_buckets: ['Work'] })
      })
      
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('creates new preferences when none exist', async () => {
      const mockUser = { id: 'test-user-id' }
      const newPreferences = {
        life_buckets: ['Work', 'Personal'],
        widgets_by_bucket: { Work: ['tasks'] }
      }

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } })
      
      // No existing prefs
      currentSelectSingle = jest.fn().mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' },
      })

      // Successful upsert
      currentUpsertSingle = jest.fn().mockResolvedValue({ 
        data: { user_id: mockUser.id, ...newPreferences }, 
        error: null,
      })

      const request = new NextRequest('http://localhost:3000/api/user/preferences', {
        method: 'POST',
        body: JSON.stringify(newPreferences)
      })
      
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject(newPreferences)
    })
  })
})