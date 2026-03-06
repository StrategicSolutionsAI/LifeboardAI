import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { withErrorHandling, createApiError } from '@/lib/api-error-handler'
import { parseBody, inviteHouseholdMemberSchema } from '@/lib/validations'

// POST — Invite by email: creates a pending household_members row
async function postHandler(request: NextRequest) {
  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw createApiError('Unauthorized', 401, 'AUTH_REQUIRED')

  const body = await request.json()
  const parsed = parseBody(inviteHouseholdMemberSchema, body)
  if (parsed.error) return parsed.response!

  const email = parsed.data.email.toLowerCase().trim()

  // Find user's household where they are admin
  const { data: adminMembership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!adminMembership) {
    throw createApiError('No household found or insufficient permissions', 403, 'NOT_ADMIN')
  }

  // Check for duplicate invite
  const { data: existingInvite } = await supabase
    .from('household_members')
    .select('id, status')
    .eq('household_id', adminMembership.household_id)
    .eq('invited_email', email)
    .maybeSingle()

  if (existingInvite) {
    throw createApiError(
      existingInvite.status === 'active'
        ? 'This person is already a member'
        : 'An invite has already been sent to this email',
      400,
      'DUPLICATE_INVITE',
    )
  }

  // Create pending member
  const { data: invite, error } = await supabase
    .from('household_members')
    .insert({
      household_id: adminMembership.household_id,
      invited_email: email,
      display_name: parsed.data.displayName || email.split('@')[0],
      role: 'member',
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw createApiError('Failed to create invite', 500, 'DB_ERROR', error)

  return NextResponse.json({ invite }, { status: 201 })
}

export const POST = withErrorHandling(postHandler, 'household/invite/POST')
