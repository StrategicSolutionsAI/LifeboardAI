import { NextRequest, NextResponse } from 'next/server'
import { withAuthAndBody } from '@/lib/api-utils'
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

  // Read-only refresh: return current dashboard state as the tool output
  if (body.action === 'refresh_context') {
    const { systemContext } = await buildChatContext(req)
    return NextResponse.json({
      success: true,
      message: systemContext || 'No dashboard data available.',
    })
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`
  const result = await executeCommand(body, { supabase, userId: user.id, req, origin })
  return NextResponse.json(result)
}, 'POST /api/chat/execute-command')
