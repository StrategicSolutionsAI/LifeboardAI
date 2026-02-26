import { NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

// Run on page routes only — skip static assets, images, fonts, and monitoring
export const config = {
  matcher: [
    '/',
    '/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$).*)',
  ],
}
