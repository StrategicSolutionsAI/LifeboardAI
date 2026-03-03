import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { supabaseFromBearer } from '@/utils/supabase/bearer'
import { handleApiError } from '@/lib/api-error-handler'
import { parseBody } from '@/lib/validations'
import type { z } from 'zod'

/**
 * Unified client factory — Bearer token takes priority, cookies as fallback.
 * Single source of truth; replaces the local copies in route files.
 */
export function getClientFromRequest(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    return supabaseFromBearer(auth.slice(7))
  }
  return supabaseServer()
}

type SupabaseClient = ReturnType<typeof supabaseServer>

interface AuthContext {
  supabase: SupabaseClient
  user: { id: string; email?: string; [key: string]: any }
}

type AuthedHandler = (
  req: NextRequest,
  ctx: AuthContext,
  routeContext?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>

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
  ): Promise<NextResponse> => {
    try {
      const supabase = getClientFromRequest(req)
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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
) => Promise<NextResponse>

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
