"use client"

import { useState, useCallback } from 'react'
import { useDataCache } from '@/hooks/use-data-cache'
import type { Household, HouseholdMember, RosterMember } from '@/types/household'

interface HouseholdData {
  household: Household | null
  members: HouseholdMember[]
  role: 'admin' | 'member' | null
  selfMemberId: string | null
}

export interface InviteResult {
  inviteUrl: string
  emailed: boolean
}

interface UseHouseholdReturn {
  household: Household | null
  members: HouseholdMember[]
  role: 'admin' | 'member' | null
  selfMemberId: string | null
  isLoading: boolean
  error: string | null
  createHousehold: (name: string, roster?: RosterMember[]) => Promise<Household | null>
  inviteMember: (email: string, displayName?: string) => Promise<InviteResult | null>
  saveRoster: (roster: RosterMember[]) => Promise<boolean>
  updateMember: (memberId: string, updates: { role?: string; displayName?: string }) => Promise<boolean>
  removeMember: (memberId: string) => Promise<boolean>
  refresh: () => Promise<void>
}

export const HOUSEHOLD_CACHE_KEY = 'household-data'
const HOUSEHOLD_TTL = 5 * 60 * 1000 // 5 minutes

export async function fetchHouseholdData(): Promise<HouseholdData> {
  const res = await fetch('/api/household')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to fetch household')
  }
  return res.json()
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export function useHousehold(): UseHouseholdReturn {
  const {
    data: cachedData,
    loading: isLoading,
    error: cacheError,
    invalidate,
    updateOptimistically,
  } = useDataCache<HouseholdData>(HOUSEHOLD_CACHE_KEY, fetchHouseholdData, {
    ttl: HOUSEHOLD_TTL,
  })

  const [mutationError, setMutationError] = useState<string | null>(null)
  const error = mutationError || (cacheError ? String(cacheError) : null)

  // Every mutation clears the last error, reports a new one, and refetches.
  const mutate = useCallback(async <T,>(run: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      setMutationError(null)
      const result = await run()
      invalidate()
      return result
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Something went wrong')
      return fallback
    }
  }, [invalidate])

  const createHousehold = useCallback((name: string, roster?: RosterMember[]) =>
    mutate(async () => (await send('/api/household', 'POST', { name, roster })).household as Household, null),
  [mutate])

  const inviteMember = useCallback((email: string, displayName?: string) =>
    mutate(async () => {
      const data = await send('/api/household/invite', 'POST', { email, displayName })
      return { inviteUrl: data.inviteUrl as string, emailed: Boolean(data.emailed) }
    }, null),
  [mutate])

  const saveRoster = useCallback(async (roster: RosterMember[]) => {
    // Optimistic: the roster renders from the cache, so update it before the round trip.
    updateOptimistically((current) =>
      current?.household ? { ...current, household: { ...current.household, familyRoster: roster } } : (current as HouseholdData))
    return mutate(async () => { await send('/api/household/roster', 'PUT', { roster }); return true }, false)
  }, [updateOptimistically, mutate])

  const updateMember = useCallback((memberId: string, updates: { role?: string; displayName?: string }) =>
    mutate(async () => { await send('/api/household/members', 'PATCH', { memberId, ...updates }); return true }, false),
  [mutate])

  const removeMember = useCallback((memberId: string) =>
    mutate(async () => { await send(`/api/household/members?memberId=${memberId}`, 'DELETE'); return true }, false),
  [mutate])

  const refresh = useCallback(async () => { invalidate() }, [invalidate])

  return {
    household: cachedData?.household ?? null,
    members: cachedData?.members ?? [],
    role: cachedData?.role ?? null,
    selfMemberId: cachedData?.selfMemberId ?? null,
    isLoading,
    error,
    createHousehold,
    inviteMember,
    saveRoster,
    updateMember,
    removeMember,
    refresh,
  }
}
