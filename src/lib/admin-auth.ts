import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { timingSafeEqual } from 'crypto'

/**
 * Validates admin authentication for protected admin routes.
 * Checks:
 * 1. Production gate (ENABLE_ADMIN_ROUTES)
 * 2. Supabase user authentication
 * 3. Admin secret header (timing-safe comparison)
 *
 * @returns `null` if authorized, or a NextResponse error to return early
 */
export async function validateAdminAuth(
  request: Request
): Promise<NextResponse | null> {
  // Block in production unless explicitly enabled
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ENABLE_ADMIN_ROUTES !== 'true'
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Require authentication
  const supabaseAuth = supabaseServer()
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Require admin secret header with timing-safe comparison
  const adminSecret = request.headers.get('x-admin-secret')
  const expectedSecret = process.env.ADMIN_SECRET

  if (!adminSecret || !expectedSecret || !safeCompare(adminSecret, expectedSecret)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null // Authorized
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses crypto.timingSafeEqual under the hood.
 */
function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf-8')
    const bufB = Buffer.from(b, 'utf-8')

    // timingSafeEqual requires equal-length buffers, so pad if needed
    if (bufA.length !== bufB.length) {
      // Still do a comparison to avoid leaking length difference via timing
      const padded = Buffer.alloc(bufA.length)
      timingSafeEqual(bufA, padded)
      return false
    }

    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}
