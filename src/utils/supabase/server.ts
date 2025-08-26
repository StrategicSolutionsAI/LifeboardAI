import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

let cachedClient: ReturnType<typeof createServerClient> | null = null

export function supabaseServer() {
  if (cachedClient) return cachedClient

  cachedClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: async () =>
          cookies().getAll().map(({ name, value }) => ({ name, value })),
        setAll: async (all) => {
          try {
            all.forEach(({ name, value, options }) => {
              cookies().set(name, value, options)
            })
          } catch {
            // Writing cookies isn't allowed in Server Components –
            // this will be handled by middleware on the response instead.
          }
        },
      },
    },
  )

  return cachedClient
}
