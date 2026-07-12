import { NextRequest, NextResponse } from 'next/server'
import { getRequestOrigin, withAuthAndBody } from '@/lib/api-utils'
import { executeCommandSchema } from '@/lib/validations'
import { executeCommand } from '@/lib/chat-commands'
import { buildChatContext } from '@/lib/chat-context'
import { apiLimiter, getRateLimitKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Executes one Lifeboard command on behalf of the realtime voice agent.
 * OpenAI Realtime tool calls surface on the client (WebRTC data channel);
 * the client forwards each call here so execution reuses the same
 * executeCommand() path as the HTTP chat routes.
 */
export const POST = withAuthAndBody(executeCommandSchema, async (req, { supabase, user, body }) => {
  const rateLimited = apiLimiter.check(getRateLimitKey(req, user.id))
  if (rateLimited) return rateLimited

  // Read-only refresh: return current dashboard state as the tool output.
  // `mutated` tells the client whether to refresh dashboard data — keyed on
  // the response so new read-only tools don't need client-side name checks.
  if (body.action === 'refresh_context') {
    const { systemContext } = await buildChatContext(req)
    return NextResponse.json({
      success: true,
      mutated: false,
      message: systemContext || 'No dashboard data available.',
    })
  }

  const result = await executeCommand(body, { supabase, userId: user.id, req, origin: getRequestOrigin(req) })
  return NextResponse.json({ ...result, mutated: result.success })
}, 'POST /api/chat/execute-command')
