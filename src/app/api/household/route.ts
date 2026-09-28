import { NextResponse } from 'next/server'
import { withAuth, withAuthAndBody } from '@/lib/api-utils'
import { createApiError } from '@/lib/api-error-handler'
import { createHouseholdSchema } from '@/lib/validations'
import { invalidateDataScope } from '@/lib/household/scope'
import {
  HOUSEHOLD_MEMBER_SELECT_COLUMNS,
  HOUSEHOLD_SELECT_COLUMNS,
  mapRowToHousehold,
  mapRowToHouseholdMember,
} from '@/repositories/household'

// no-store: read right after invites and joins; an HTTP-cached copy would hide them.
const NO_STORE = { 'Cache-Control': 'no-store' }

// GET — the current user's household, its members, and the caller's own membership
export const GET = withAuth(async (_req, { supabase, user }) => {
  const { data: membership, error } = await supabase
    .from('household_members')
    .select('id, household_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (error) throw createApiError('Failed to load household', 500, 'DB_ERROR', error)
  if (!membership) {
    return NextResponse.json({ household: null, members: [], role: null, selfMemberId: null }, { headers: NO_STORE })
  }

  const [householdResult, membersResult] = await Promise.all([
    supabase.from('households').select(HOUSEHOLD_SELECT_COLUMNS).eq('id', membership.household_id).single(),
    supabase
      .from('household_members')
      .select(HOUSEHOLD_MEMBER_SELECT_COLUMNS)
      .eq('household_id', membership.household_id)
      .order('invited_at', { ascending: true }),
  ])

  if (householdResult.error) throw createApiError('Failed to load household', 500, 'DB_ERROR', householdResult.error)
  if (membersResult.error) throw createApiError('Failed to load members', 500, 'DB_ERROR', membersResult.error)

  const isAdmin = membership.role === 'admin'
  return NextResponse.json(
    {
      household: mapRowToHousehold(householdResult.data),
      members: (membersResult.data ?? []).map((row) => mapRowToHouseholdMember(row, isAdmin)),
      role: membership.role,
      selfMemberId: membership.id,
    },
    { headers: NO_STORE },
  )
}, 'GET /api/household')

// POST — create a household with the caller as admin; their existing rows become shared
export const POST = withAuthAndBody(createHouseholdSchema, async (_req, { supabase, user, body }) => {
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin'
  const { data: householdId, error } = await supabase.rpc('create_household', {
    p_name: body.name,
    p_display_name: displayName,
  })

  if (error) {
    if (error.message?.includes('ALREADY_MEMBER')) {
      throw createApiError('You already belong to a household', 409, 'ALREADY_MEMBER')
    }
    throw createApiError('Failed to create household', 500, 'DB_ERROR', error)
  }
  invalidateDataScope(user.id)

  if (body.roster && body.roster.length > 0) {
    const { error: rosterError } = await supabase
      .from('households')
      .update({ family_roster: body.roster })
      .eq('id', householdId)
    if (rosterError) console.error('Household created but roster seed failed', rosterError)
  }

  const { data: row, error: readError } = await supabase
    .from('households')
    .select(HOUSEHOLD_SELECT_COLUMNS)
    .eq('id', householdId)
    .single()
  if (readError) throw createApiError('Failed to load new household', 500, 'DB_ERROR', readError)

  return NextResponse.json({ household: mapRowToHousehold(row) }, { status: 201 })
}, 'POST /api/household')
