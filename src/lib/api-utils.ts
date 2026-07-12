import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { supabaseFromBearer } from '@/utils/supabase/bearer'
import { handleApiError } from '@/lib/api-error-handler'
import { getUserCached } from '@/lib/server-auth-cache'
import { SESSION_EXPIRED_HEADER } from '@/lib/session-expired'
import { parseBody } from '@/lib/validations'
import type { z } from 'zod'

/**
 * Origin for building absolute URLs back to our own API routes.
 * NEXT_PUBLIC_SITE_URL wins; falls back to the proxy-forwarded host.
 */
export function getRequestOrigin(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`
  )
}

/**
 * Unified client factory — Bearer token takes priority, cookies as fallback.
 * Single source of truth; replaces the local copies in route files.
 * Also surfaces the bearer token so auth validation can be cached per token.
 */
function getClientFromRequest(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7)
    return { supabase: supabaseFromBearer(token), token }
  }
  return { supabase: supabaseServer(), token: null }
}

type SupabaseClient = ReturnType<typeof supabaseServer>

interface AuthContext {
  supabase: SupabaseClient
  user: { id: string; email?: string; [key: string]: any }
}

// Handlers may return a plain Response (streaming routes like /api/chat)
// alongside the usual NextResponse.
type AuthedHandler = (
  req: NextRequest,
  ctx: AuthContext,
  routeContext?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse | Response>

/**
 * Wraps a route handler with auth check + error handling.
 *
 * Usage:
 *   export const GET = withAuth(async (req, { supabase, user }) => {
 *     // ... handler body — no try/catch, no auth check needed
 *     return NextResponse.json({ ... })
 *   }, 'GET /api/tasks')
 */
export function withAuth(handler: AuthedHandler, routeName?: string) {
  return async (
    req: NextRequest,
    routeContext?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse | Response> => {
    try {
      const { supabase, token } = getClientFromRequest(req)
      const { data: { user }, error: authError } = await getUserCached(supabase, token)
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401, headers: { [SESSION_EXPIRED_HEADER]: '1' } }
        )
      }
      return await handler(req, { supabase, user }, routeContext)
    } catch (error) {
      return handleApiError(error, routeName)
    }
  }
}

type AuthedBodyHandler<T> = (
  req: NextRequest,
  ctx: AuthContext & { body: T },
  routeContext?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse | Response>

/**
 * Convenience wrapper that also parses + validates the JSON body with Zod.
 *
 * Usage:
 *   export const POST = withAuthAndBody(createTaskSchema, async (req, { supabase, user, body }) => {
 *     // body is fully typed
 *     return NextResponse.json({ ... })
 *   }, 'POST /api/tasks')
 */
export function withAuthAndBody<T extends z.ZodType>(
  schema: T,
  handler: AuthedBodyHandler<z.infer<T>>,
  routeName?: string
) {
  return withAuth(async (req, ctx, routeContext) => {
    const rawBody = await req.json().catch(() => ({}))
    const parsed = parseBody(schema, rawBody)
    if (parsed.response) {
      return parsed.response
    }
    return handler(req, { ...ctx, body: parsed.data }, routeContext)
  }, routeName)
}
