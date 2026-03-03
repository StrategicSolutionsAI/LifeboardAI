import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,      // 5 minutes — matches current TTL
        gcTime: 10 * 60 * 1000,         // 10 minutes garbage collection
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
