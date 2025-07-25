/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET, POST } from '../route'

// Mock supabase server
jest.mock('@/utils/supabase/server', () => ({
  supabaseServer: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      upsert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  })),
}))

describe('/api/user/preferences', () => {
  const mockSupabase = require('@/utils/supabase/server').supabaseServer()

  beforeEach(() => {
    jest.clearAllMocks()
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
      
      const mockSingle = jest.fn().mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } // Not found error
      })
      mockSupabase.from().select().eq().single = mockSingle

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
      
      const mockSingle = jest.fn().mockResolvedValue({ 
        data: mockPreferences, 
        error: null
      })
      mockSupabase.from().select().eq().single = mockSingle

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
      
      // Mock no existing preferences
      const mockSelectSingle = jest.fn().mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' }
      })
      mockSupabase.from().select().eq().single = mockSelectSingle

      // Mock successful upsert
      const mockUpsertSingle = jest.fn().mockResolvedValue({ 
        data: { user_id: mockUser.id, ...newPreferences }, 
        error: null
      })
      mockSupabase.from().upsert().select().single = mockUpsertSingle

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