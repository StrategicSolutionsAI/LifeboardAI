import { prefetchToGlobalCache } from '@/hooks/use-data-cache'
import { fetchNotes, NOTES_CACHE_KEY, type Note } from '@/hooks/use-notes'

/**
 * Warm the notes cache ahead of navigation (e.g. on sidebar hover) so /notes
 * renders from cache instead of showing a skeleton for a full round trip.
 */
export function prefetchNotes(): void {
  if (typeof window === 'undefined') return
  prefetchToGlobalCache<Note[]>(NOTES_CACHE_KEY, fetchNotes)
}
