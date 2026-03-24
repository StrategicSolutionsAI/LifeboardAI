import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withAuthAndBody } from '@/lib/api-utils'
import {
  createBudgetExpenseSchema,
  updateBudgetExpenseSchema,
  deleteBudgetExpenseSchema,
} from '@/lib/validations'
import {
  BUDGET_EXPENSE_SELECT_COLUMNS,
  mapRowToExpense,
} from '@/repositories/budget'

export const GET = withAuth(async (req, { supabase, user }) => {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // YYYY-MM-01
  if (!month) {
    return NextResponse.json({ error: 'month query param required' }, { status: 400 })
  }

  // Compute month range
  const [y, m] = month.split('-').map(Number)
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`
  const endYear = m === 12 ? y + 1 : y
  const endMonth = m === 12 ? 1 : m + 1
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  let query = supabase
    .from('budget_expenses')
    .select(BUDGET_EXPENSE_SELECT_COLUMNS)
    .eq('user_id', user.id)
    .gte('date', startDate)
    .lt('date', endDate)
    .order('date', { ascending: false })

  const categoryId = searchParams.get('categoryId')
  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  const { data: rows, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ expenses: (rows ?? []).map(mapRowToExpense) })
}, 'GET /api/budget/expenses')

export const POST = withAuthAndBody(createBudgetExpenseSchema, async (_req, { supabase, user, body }) => {
  const { data: row, error } = await supabase
    .from('budget_expenses')
    .insert({
      user_id: user.id,
      category_id: body.categoryId,
      amount: body.amount,
      date: body.date ?? new Date().toISOString().slice(0, 10),
      note: body.note ?? null,
    })
    .select(BUDGET_EXPENSE_SELECT_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ expense: mapRowToExpense(row) }, { status: 201 })
}, 'POST /api/budget/expenses')

export const PATCH = withAuthAndBody(updateBudgetExpenseSchema, async (_req, { supabase, user, body }) => {
  const updates: Record<string, unknown> = {}
  if (body.categoryId !== undefined) updates.category_id = body.categoryId
  if (body.amount !== undefined) updates.amount = body.amount
  if (body.date !== undefined) updates.date = body.date
  if (body.note !== undefined) updates.note = body.note

  const { data: row, error } = await supabase
    .from('budget_expenses')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', user.id)
    .select(BUDGET_EXPENSE_SELECT_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ expense: mapRowToExpense(row) })
}, 'PATCH /api/budget/expenses')

export const DELETE = withAuthAndBody(deleteBudgetExpenseSchema, async (_req, { supabase, user, body }) => {
  const { error } = await supabase
    .from('budget_expenses')
    .delete()
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}, 'DELETE /api/budget/expenses')
