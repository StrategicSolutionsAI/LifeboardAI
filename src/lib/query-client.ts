import { QueryClient } from '@tanstack/react-query'
import { QUERY_STALE_TIME_MS, QUERY_GC_TIME_MS } from '@/lib/cache-config'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

let browserClient: QueryClient | undefined

export function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }
  if (!browserClient) {
    browserClient = makeQueryClient()
  }
  return browserClient
}

/** Clear all cached queries and reset the singleton (call on sign-out). */
export function resetQueryClient() {
  if (browserClient) {
    browserClient.clear()
  }
}
