import { useEffect, useState } from 'react'
import type { WidgetInstance } from '@/types/widgets'

export interface FamilyMemberOption {
  id: string
  name: string
  avatarColor: string
  relationship: string
}

/**
 * Lightweight hook that loads family members from the Family Members widget
 * stored in user_preferences.widgets_by_bucket. Designed to be used on any page
 * that renders a TaskEditorModal so the "Assign to" picker always appears.
 *
 * Caches at module level so multiple mounts don't re-fetch.
 */

let _cache: { data: FamilyMemberOption[]; ts: number } | null = null
const CACHE_TTL = 15_000 // 15s

export function useFamilyMembers(): FamilyMemberOption[] {
  const [members, setMembers] = useState<FamilyMemberOption[]>(_cache?.data ?? [])

  useEffect(() => {
    if (_cache && Date.now() - _cache.ts < CACHE_TTL) {
      setMembers(_cache.data)
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/user/preferences', { credentials: 'same-origin' })
        if (!res.ok || cancelled) return
        const json = await res.json()
        const widgetsByBucket: Record<string, WidgetInstance[]> = json?.widgets_by_bucket ?? {}
        const allWidgets = Object.values(widgetsByBucket).flat()
        const fmWidget = allWidgets.find((w) => w.id === 'family_members')
        const raw = fmWidget?.familyMembersData?.members
        if (!Array.isArray(raw) || cancelled) {
          _cache = { data: [], ts: Date.now() }
          return
        }
        const result: FamilyMemberOption[] = raw.map((m) => ({
          id: m.id,
          name: m.name,
          avatarColor: m.avatarColor,
          relationship: m.relationship,
        }))
        _cache = { data: result, ts: Date.now() }
        if (!cancelled) setMembers(result)
      } catch {
        // silently fail — picker just won't show
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
