'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query-client'
import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'

// Only load devtools in development — dynamic import prevents the 280 KB
// module from being included in the production bundle at all.
const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(() =>
        import('@tanstack/react-query-devtools').then(m => ({
          default: m.ReactQueryDevtools,
        }))
      )
    : () => null

export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
