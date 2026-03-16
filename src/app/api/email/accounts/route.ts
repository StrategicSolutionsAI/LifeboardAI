import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/email/accounts
 * Returns list of connected Gmail accounts (provider_user_id values).
 */
export const GET = withAuth(async (_req: NextRequest, { supabase, user }) => {
  const { data: integrations } = await supabase
    .from('user_integrations')
    .select('provider_user_id')
    .eq('user_id', user.id)
    .eq('provider', 'gmail')

  const accounts = (integrations ?? [])
    .map((r: any) => r.provider_user_id)
    .filter(Boolean) as string[]

  return NextResponse.json({ accounts })
}, 'GET /api/email/accounts')
