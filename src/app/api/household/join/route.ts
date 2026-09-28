import { NextResponse } from 'next/server'
import { withAuthAndBody } from '@/lib/api-utils'
import { createApiError } from '@/lib/api-error-handler'
import { joinHouseholdSchema } from '@/lib/validations'
import { invalidateDataScope } from '@/lib/household/scope'
import { PENDING_INVITE_COOKIE } from '@/lib/household/pending-invite'

const JOIN_ERRORS: Record<string, [string, number]> = {
  INVITE_NOT_FOUND: ['This invite link is no longer valid', 404],
  INVITE_USED: ['This invite has already been used', 409],
  ALREADY_MEMBER: ['You already share a household with other people. Leave it before joining another.', 409],
}

// POST — accept an invite. The RPC activates the membership, which shares the
// joiner's calendar, tasks, shopping list and budget with the household.
export const POST = withAuthAndBody(joinHouseholdSchema, async (_req, { supabase, user, body }) => {
  const { data: householdId, error } = await supabase.rpc('accept_household_invite', { p_token: body.token })

  if (error) {
    const code = Object.keys(JOIN_ERRORS).find((key) => error.message?.includes(key))
    if (code) throw createApiError(JOIN_ERRORS[code][0], JOIN_ERRORS[code][1], code)
    throw createApiError('Failed to join household', 500, 'DB_ERROR', error)
  }

  invalidateDataScope(user.id)
  const res = NextResponse.json({ householdId })
  res.cookies.delete(PENDING_INVITE_COOKIE)
  return res
}, 'POST /api/household/join')
