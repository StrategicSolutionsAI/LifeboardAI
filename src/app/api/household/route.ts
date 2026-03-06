import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/server'
import { withErrorHandling, createApiError } from '@/lib/api-error-handler'
import { parseBody, createHouseholdSchema } from '@/lib/validations'

// GET — Fetch current user's household + members
async function getHandler(request: NextRequest) {
  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw createApiError('Unauthorized', 401, 'AUTH_REQUIRED')

  // Find the user's household via household_members
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ household: null, members: [] })
  }

  const [householdResult, membersResult] = await Promise.all([
    supabase
      .from('households')
      .select('*')
      .eq('id', membership.household_id)
      .single(),
    supabase
      .from('household_members')
      .select('*')
      .eq('household_id', membership.household_id)
      .order('invited_at', { ascending: true }),
  ])

  return NextResponse.json({
    household: householdResult.data,
    members: membersResult.data || [],
  })
}

// POST — Create a household, auto-add creator as admin
async function postHandler(request: NextRequest) {
  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw createApiError('Unauthorized', 401, 'AUTH_REQUIRED')

  // Check if user already has a household
  const { data: existing } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (existing) {
    throw createApiError('User already belongs to a household', 400, 'ALREADY_MEMBER')
  }

  const body = await request.json()
  const parsed = parseBody(createHouseholdSchema, body)
  if (parsed.error) return parsed.response!

  // Create household
  const { data: household, error: hErr } = await supabase
    .from('households')
    .insert({ name: parsed.data.name, created_by: user.id })
    .select()
    .single()

  if (hErr) throw createApiError('Failed to create household', 500, 'DB_ERROR', hErr)

  // Add creator as admin member
  const { error: mErr } = await supabase
    .from('household_members')
    .insert({
      household_id: household.id,
      user_id: user.id,
      role: 'admin',
      status: 'active',
      display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin',
      invited_email: user.email,
      joined_at: new Date().toISOString(),
    })

  if (mErr) throw createApiError('Failed to add admin member', 500, 'DB_ERROR', mErr)

  return NextResponse.json({ household }, { status: 201 })
}

export const GET = withErrorHandling(getHandler, 'household/GET')
export const POST = withErrorHandling(postHandler, 'household/POST')
