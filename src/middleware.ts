import { NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

// Run on page routes only — skip static assets, images, fonts, monitoring,
// and API routes (they don't render HTML so CSP/nonce overhead is wasted).
// Auth session refresh for API routes happens in-route via createClient().
// PWA assets (sw.js, manifest.json, offline.html) and crawler/metadata routes
// (robots.txt, sitemap.xml, opengraph-image, apple-icon) must also be skipped:
// they are fetched without cookies (the manifest by spec even when logged in),
// so the auth gate would 307 them to /login and break SW registration,
// add-to-home-screen, and search indexing.
export const config = {
  matcher: [
    '/',
    '/((?!_next/static|_next/image|favicon.ico|monitoring|api/|sw\\.js|manifest\\.json|offline\\.html|robots\\.txt|sitemap\\.xml|opengraph-image|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$).*)',
  ],
}
