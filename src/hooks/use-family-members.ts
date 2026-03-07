import { useEffect, useState } from 'react'
import type { WidgetInstance } from '@/types/widgets'

export interface FamilyMemberOption {
  id: string
  name: string
  avatarColor: string
  relationship: string
}

/**
 * Lightweight hook that loads family members from the Family Members widget.
 * Checks both Supabase (via API) and localStorage (for data not yet flushed).
 * Designed to be used on any page that renders a TaskEditorModal.
 */

let _cache: { data: FamilyMemberOption[]; ts: number } | null = null
const CACHE_TTL = 15_000 // 15s

function extractFamilyMembers(widgetsByBucket: Record<string, WidgetInstance[]>): FamilyMemberOption[] {
  const allWidgets = Object.values(widgetsByBucket).flat()
  const fmWidget = allWidgets.find((w) => w.id === 'family_members')
  const raw = fmWidget?.familyMembersData?.members
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw.map((m) => ({
    id: m.id,
    name: m.name,
    avatarColor: m.avatarColor,
    relationship: m.relationship,
  }))
}

function tryLocalStorage(): FamilyMemberOption[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem('widgets_by_bucket')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    // localStorage format: { widgets: Record<string, WidgetInstance[]>, savedAt: string }
    const widgets: Record<string, WidgetInstance[]> = parsed.widgets || parsed
    return extractFamilyMembers(widgets)
  } catch {
    return []
  }
}

export function useFamilyMembers(): FamilyMemberOption[] {
  const [members, setMembers] = useState<FamilyMemberOption[]>(() => _cache?.data ?? tryLocalStorage())

  useEffect(() => {
    if (_cache && Date.now() - _cache.ts < CACHE_TTL) {
      setMembers(_cache.data)
      return
    }

    // Immediately check localStorage for fresh data
    const lsMembers = tryLocalStorage()
    if (lsMembers.length > 0) {
      _cache = { data: lsMembers, ts: Date.now() }
      setMembers(lsMembers)
    }

    let cancelled = false

    // Also fetch from API (source of truth) in background
    ;(async () => {
      try {
        const res = await fetch('/api/user/preferences', { credentials: 'same-origin' })
        if (!res.ok || cancelled) return
        const json = await res.json()
        const widgetsByBucket: Record<string, WidgetInstance[]> = json?.widgets_by_bucket ?? {}
        const result = extractFamilyMembers(widgetsByBucket)
        // Prefer API result if it has data; otherwise keep localStorage result
        if (result.length > 0 || lsMembers.length === 0) {
          _cache = { data: result, ts: Date.now() }
          if (!cancelled) setMembers(result)
        }
      } catch {
        // silently fail — localStorage data already applied
      }
    })()

    return () => { cancelled = true }
  }, [])

  return members
}

/** Invalidate the module-level cache (call after editing family members). */
export function invalidateFamilyMembersCache() {
  _cache = null
}
