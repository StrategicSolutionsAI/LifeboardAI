import { NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

// Run on page routes only — skip static assets, images, fonts, monitoring,
// and API routes (they don't render HTML so CSP/nonce overhead is wasted).
// Auth session refresh for API routes happens in-route via createClient().
export const config = {
  matcher: [
    '/',
    '/((?!_next/static|_next/image|favicon.ico|monitoring|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$).*)',
  ],
}
