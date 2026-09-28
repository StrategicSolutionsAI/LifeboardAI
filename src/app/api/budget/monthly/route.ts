import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withAuthAndBody } from '@/lib/api-utils'
import { getDataScope, ownedOrShared } from '@/lib/household/scope'
import { upsertMonthlyBudgetSchema } from '@/lib/validations'
import {
  MONTHLY_BUDGET_SELECT_COLUMNS,
  mapRowToBudget,
} from '@/repositories/budget'

export const GET = withAuth(async (req, { supabase, user }) => {
  const scope = await getDataScope(supabase, user.id)
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  if (!month) {
    return NextResponse.json({ error: 'month query param required' }, { status: 400 })
  }

  const { data: rows, error } = await supabase
    .from('monthly_budgets')
    .select(MONTHLY_BUDGET_SELECT_COLUMNS)
    .or(ownedOrShared(scope))
    .eq('month', month)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ budgets: (rows ?? []).map(mapRowToBudget) })
}, 'GET /api/budget/monthly')

export const POST = withAuthAndBody(upsertMonthlyBudgetSchema, async (_req, { supabase, user, body }) => {
  // One cap per category and month, whichever household member sets it
  const { data: row, error } = await supabase
    .from('monthly_budgets')
    .upsert(
      {
        user_id: user.id,
        category_id: body.categoryId,
        month: body.month,
        amount: body.amount,
      },
      { onConflict: 'category_id,month' }
    )
    .select(MONTHLY_BUDGET_SELECT_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ budget: mapRowToBudget(row) })
}, 'POST /api/budget/monthly')
