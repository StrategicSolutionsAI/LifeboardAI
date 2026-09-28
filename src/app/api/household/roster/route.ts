import { NextResponse } from 'next/server'
import { withAuthAndBody } from '@/lib/api-utils'
import { createApiError } from '@/lib/api-error-handler'
import { householdRosterSchema } from '@/lib/validations'
import { getDataScope } from '@/lib/household/scope'

// PUT — replace the shared Family Members roster (any member may edit it)
export const PUT = withAuthAndBody(householdRosterSchema, async (_req, { supabase, user, body }) => {
  const scope = await getDataScope(supabase, user.id)
  if (!scope.householdId) throw createApiError('You are not in a household', 404, 'NO_HOUSEHOLD')

  const { error } = await supabase
    .from('households')
    .update({ family_roster: body.roster })
    .eq('id', scope.householdId)

  if (error) throw createApiError('Failed to save family members', 500, 'DB_ERROR', error)
  return NextResponse.json({ roster: body.roster })
}, 'PUT /api/household/roster')
