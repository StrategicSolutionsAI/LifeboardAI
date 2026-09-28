import { NextResponse } from 'next/server'
import { withAuthAndBody, getRequestOrigin } from '@/lib/api-utils'
import { createApiError } from '@/lib/api-error-handler'
import { inviteHouseholdMemberSchema } from '@/lib/validations'
import { sendInviteViaGmail } from '@/lib/household/invite-email'
import { HOUSEHOLD_MEMBER_SELECT_COLUMNS, mapRowToHouseholdMember } from '@/repositories/household'

// POST — create a pending invite and return its shareable link. When the
// inviter's Gmail is connected the link is also emailed from their account.
export const POST = withAuthAndBody(inviteHouseholdMemberSchema, async (req, { supabase, user, body }) => {
  const email = body.email.toLowerCase().trim()

  const { data: admin, error: adminError } = await supabase
    .from('household_members')
    .select('household_id, display_name')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (adminError) throw createApiError('Failed to load household', 500, 'DB_ERROR', adminError)
  if (!admin) throw createApiError('Only a household admin can invite', 403, 'NOT_ADMIN')

  const { data: existing } = await supabase
    .from('household_members')
    .select('status')
    .eq('household_id', admin.household_id)
    .eq('invited_email', email)
    .maybeSingle()

  if (existing) {
    throw createApiError(
      existing.status === 'active' ? 'This person is already a member' : 'This email already has an invite — copy its link below',
      409,
      'DUPLICATE_INVITE',
    )
  }

  const { data: row, error } = await supabase
    .from('household_members')
    .insert({
      household_id: admin.household_id,
      invited_email: email,
      display_name: body.displayName || email.split('@')[0],
      role: 'member',
      status: 'pending',
    })
    .select(HOUSEHOLD_MEMBER_SELECT_COLUMNS)
    .single()

  if (error) throw createApiError('Failed to create invite', 500, 'DB_ERROR', error)

  const { data: household } = await supabase
    .from('households')
    .select('name')
    .eq('id', admin.household_id)
    .single()

  const inviteUrl = `${getRequestOrigin(req)}/join/${row.invite_token}`
  const emailed = await sendInviteViaGmail(supabase, user.id, {
    to: email,
    inviterName: admin.display_name || user.email || 'A family member',
    householdName: household?.name ?? 'our household',
    inviteUrl,
  })

  return NextResponse.json(
    { invite: mapRowToHouseholdMember(row, true), inviteUrl, emailed },
    { status: 201 },
  )
}, 'POST /api/household/invite')
