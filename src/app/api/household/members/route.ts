import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { withErrorHandling, createApiError } from '@/lib/api-error-handler'
import { parseBody, updateHouseholdMemberSchema } from '@/lib/validations'
import { getUserCached } from '@/lib/server-auth-cache'
import { invalidateDataScope } from '@/lib/household/scope'

// GET — List household members (active + pending)
async function getHandler(request: NextRequest) {
  const supabase = supabaseServer()
  const { data: { user } } = await getUserCached(supabase)
  if (!user) throw createApiError('Unauthorized', 401, 'AUTH_REQUIRED')

  // Find user's household
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!membership) {
    const res = NextResponse.json({ members: [] })
    res.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600')
    return res
  }

  const { data: members, error } = await supabase
    .from('household_members')
    .select('id, household_id, user_id, role, status, invited_email, display_name, invited_at, joined_at')
    .eq('household_id', membership.household_id)
    .order('invited_at', { ascending: true })

  if (error) throw createApiError('Failed to fetch members', 500, 'DB_ERROR', error)

  const res = NextResponse.json({ members: members || [] })
  res.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600')
  return res
}

// PATCH — Update a member (role, display_name)
async function patchHandler(request: NextRequest) {
  const supabase = supabaseServer()
  const { data: { user } } = await getUserCached(supabase)
  if (!user) throw createApiError('Unauthorized', 401, 'AUTH_REQUIRED')

  const body = await request.json()
  const parsed = parseBody(updateHouseholdMemberSchema, body)
  if (parsed.error) return parsed.response!

  const { memberId, role, displayName } = parsed.data

  // Verify current user is admin of the same household
  const { data: targetMember } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('id', memberId)
    .single()

  if (!targetMember) throw createApiError('Member not found', 404, 'NOT_FOUND')

  const { data: adminCheck } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', targetMember.household_id)
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!adminCheck) throw createApiError('Insufficient permissions', 403, 'NOT_ADMIN')

  const updates: Record<string, string> = {}
  if (role) updates.role = role
  if (displayName) updates.display_name = displayName

  if (Object.keys(updates).length === 0) {
    throw createApiError('No valid fields to update', 400, 'VALIDATION_ERROR')
  }

  const { data: updated, error } = await supabase
    .from('household_members')
    .update(updates)
    .eq('id', memberId)
    .select()
    .single()

  if (error) throw createApiError('Failed to update member', 500, 'DB_ERROR', error)

  return NextResponse.json({ member: updated })
}

// DELETE — Remove a member
async function deleteHandler(request: NextRequest) {
  const supabase = supabaseServer()
  const { data: { user } } = await getUserCached(supabase)
  if (!user) throw createApiError('Unauthorized', 401, 'AUTH_REQUIRED')

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('memberId')

  if (!memberId) throw createApiError('memberId required', 400, 'VALIDATION_ERROR')

  // Verify current user is admin of the same household
  const { data: targetMember } = await supabase
    .from('household_members')
    .select('household_id, user_id')
    .eq('id', memberId)
    .single()

  if (!targetMember) throw createApiError('Member not found', 404, 'NOT_FOUND')

  const isSelf = targetMember.user_id === user.id

  if (isSelf) {
    // The last admin leaving would strand everyone else with no one able to invite.
    const { data: others } = await supabase
      .from('household_members')
      .select('user_id, role')
      .eq('household_id', targetMember.household_id)
      .eq('status', 'active')
      .neq('user_id', user.id)
    const { data: me } = await supabase
      .from('household_members')
      .select('role')
      .eq('id', memberId)
      .single()
    if (me?.role === 'admin' && (others ?? []).length > 0 && !(others ?? []).some((m) => m.role === 'admin')) {
      throw createApiError('Make another member an admin before leaving', 409, 'LAST_ADMIN')
    }
  } else {
    // Only admins can remove other members
    const { data: adminCheck } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', targetMember.household_id)
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (!adminCheck) throw createApiError('Insufficient permissions', 403, 'NOT_ADMIN')
  }
  // Self-removal is allowed (leave household) — admins who are the last admin cannot leave

  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('id', memberId)

  if (error) throw createApiError('Failed to remove member', 500, 'DB_ERROR', error)

  // Leaving takes the member's own rows private again (DB trigger); drop the
  // cached scope so their next request stops asking for household rows.
  if (targetMember.user_id) invalidateDataScope(targetMember.user_id)
  return NextResponse.json({ success: true })
}

export const GET = withErrorHandling(getHandler, 'household/members/GET')
export const PATCH = withErrorHandling(patchHandler, 'household/members/PATCH')
export const DELETE = withErrorHandling(deleteHandler, 'household/members/DELETE')
