"use client"

import { useState, useCallback } from 'react'
import { useDataCache } from '@/hooks/use-data-cache'

interface Household {
  id: string
  name: string
  created_by: string
  created_at: string
}

interface HouseholdMember {
  id: string
  household_id: string
  user_id: string | null
  role: 'admin' | 'member'
  status: 'pending' | 'active'
  invited_email: string | null
  display_name: string | null
  invited_at: string
  joined_at: string | null
}

interface HouseholdData {
  household: Household | null
  members: HouseholdMember[]
}

interface UseHouseholdReturn {
  household: Household | null
  members: HouseholdMember[]
  isLoading: boolean
  error: string | null
  createHousehold: (name: string) => Promise<Household | null>
  inviteMember: (email: string, displayName?: string) => Promise<boolean>
  updateMember: (memberId: string, updates: { role?: string; displayName?: string }) => Promise<boolean>
  removeMember: (memberId: string) => Promise<boolean>
  refresh: () => Promise<void>
}

const HOUSEHOLD_CACHE_KEY = 'household-data'
const HOUSEHOLD_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchHouseholdData(): Promise<HouseholdData> {
  const res = await fetch('/api/household')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to fetch household')
  }
  return res.json()
}

export function useHousehold(): UseHouseholdReturn {
  const {
    data: cachedData,
    loading: isLoading,
    error: cacheError,
    invalidate,
  } = useDataCache<HouseholdData>(HOUSEHOLD_CACHE_KEY, fetchHouseholdData, {
    ttl: HOUSEHOLD_TTL,
  })

  const [mutationError, setMutationError] = useState<string | null>(null)

  const household = cachedData?.household ?? null
  const members = cachedData?.members ?? []
  const error = mutationError || (cacheError ? String(cacheError) : null)

  const refresh = useCallback(async () => {
    invalidate()
  }, [invalidate])

  const createHousehold = useCallback(async (name: string): Promise<Household | null> => {
    try {
      setMutationError(null)
      const res = await fetch('/api/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create household')
      }
      const data = await res.json()
      invalidate()
      return data.household
    } catch (e: any) {
      setMutationError(e.message)
      return null
    }
  }, [invalidate])

  const inviteMember = useCallback(async (email: string, displayName?: string): Promise<boolean> => {
    try {
      setMutationError(null)
      const res = await fetch('/api/household/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send invite')
      }
      invalidate()
      return true
    } catch (e: any) {
      setMutationError(e.message)
      return false
    }
  }, [invalidate])

  const updateMember = useCallback(async (
    memberId: string,
    updates: { role?: string; displayName?: string },
  ): Promise<boolean> => {
    try {
      setMutationError(null)
      const res = await fetch('/api/household/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, ...updates }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update member')
      }
      invalidate()
      return true
    } catch (e: any) {
      setMutationError(e.message)
      return false
    }
  }, [invalidate])

  const removeMember = useCallback(async (memberId: string): Promise<boolean> => {
    try {
      setMutationError(null)
      const res = await fetch(`/api/household/members?memberId=${memberId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to remove member')
      }
      invalidate()
      return true
    } catch (e: any) {
      setMutationError(e.message)
      return false
    }
  }, [invalidate])

  return {
    household,
    members,
    isLoading,
    error,
    createHousehold,
    inviteMember,
    updateMember,
    removeMember,
    refresh,
  }
}
