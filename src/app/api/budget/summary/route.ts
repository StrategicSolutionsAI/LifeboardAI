import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import {
  BUDGET_CATEGORY_SELECT_COLUMNS,
  mapRowToCategory,
} from '@/repositories/budget'
import { getBudgetHealthLevel } from '@/types/budget'
import { computeHealthScore } from '@/lib/budget-utils'
import type { CategoryBudgetSummary, MonthlyBudgetSummary } from '@/types/budget'

export const GET = withAuth(async (req, { supabase, user }) => {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  if (!month) {
    return NextResponse.json({ error: 'month query param required' }, { status: 400 })
  }

  // Compute month range for expenses
  const [y, m] = month.split('-').map(Number)
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`
  const endYear = m === 12 ? y + 1 : y
  const endMonth = m === 12 ? 1 : m + 1
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  // Fetch all three in parallel
  const [categoriesRes, budgetsRes, expensesRes] = await Promise.all([
    supabase
      .from('budget_categories')
      .select(BUDGET_CATEGORY_SELECT_COLUMNS)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('monthly_budgets')
      .select('category_id, amount')
      .eq('user_id', user.id)
      .eq('month', month),
    supabase
      .from('budget_expenses')
      .select('category_id, amount')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lt('date', endDate),
  ])

  if (categoriesRes.error) {
    return NextResponse.json({ error: categoriesRes.error.message }, { status: 500 })
  }

  // Build lookup maps
  const budgetMap = new Map<string, number>()
  for (const b of budgetsRes.data ?? []) {
    budgetMap.set(b.category_id, Number(b.amount))
  }

  const spentMap = new Map<string, number>()
  for (const e of expensesRes.data ?? []) {
    const prev = spentMap.get(e.category_id) ?? 0
    spentMap.set(e.category_id, prev + Number(e.amount))
  }

  let totalBudget = 0
  let totalSpent = 0

  const categories: CategoryBudgetSummary[] = (categoriesRes.data ?? []).map((row: any) => {
    const category = mapRowToCategory(row)
    const budgetAmount = budgetMap.get(category.id) ?? 0
    const spentAmount = spentMap.get(category.id) ?? 0
    const remainingAmount = budgetAmount - spentAmount
    const percentUsed = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : (spentAmount > 0 ? 100 : 0)
    totalBudget += budgetAmount
    totalSpent += spentAmount
    return {
      category,
      budgetAmount,
      spentAmount,
      remainingAmount,
      percentUsed,
      healthLevel: getBudgetHealthLevel(percentUsed),
    }
  })

  const summary: MonthlyBudgetSummary = {
    month,
    totalBudget,
    totalSpent,
    totalRemaining: totalBudget - totalSpent,
    healthScore: computeHealthScore(totalBudget, totalSpent),
    categories,
  }

  return NextResponse.json({ summary })
}, 'GET /api/budget/summary')
