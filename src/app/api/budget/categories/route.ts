import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withAuthAndBody } from '@/lib/api-utils'
import {
  createBudgetCategorySchema,
  updateBudgetCategorySchema,
  deleteBudgetCategorySchema,
} from '@/lib/validations'
import {
  BUDGET_CATEGORY_SELECT_COLUMNS,
  mapRowToCategory,
} from '@/repositories/budget'
import { DEFAULT_BUDGET_CATEGORIES } from '@/types/budget'

export const GET = withAuth(async (_req, { supabase, user }) => {
  const { data: rows, error } = await supabase
    .from('budget_categories')
    .select(BUDGET_CATEGORY_SELECT_COLUMNS)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Auto-seed defaults on first call
  if (rows.length === 0) {
    const seedRows = DEFAULT_BUDGET_CATEGORIES.map((c, i) => ({
      user_id: user.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      is_default: true,
      sort_order: i,
    }))
    const { data: inserted, error: seedError } = await supabase
      .from('budget_categories')
      .insert(seedRows)
      .select(BUDGET_CATEGORY_SELECT_COLUMNS)

    if (seedError) {
      return NextResponse.json({ error: seedError.message }, { status: 500 })
    }
    return NextResponse.json({ categories: (inserted ?? []).map(mapRowToCategory) })
  }

  return NextResponse.json({ categories: rows.map(mapRowToCategory) })
}, 'GET /api/budget/categories')

export const POST = withAuthAndBody(createBudgetCategorySchema, async (_req, { supabase, user, body }) => {
  const { data: row, error } = await supabase
    .from('budget_categories')
    .insert({
      user_id: user.id,
      name: body.name,
      icon: body.icon ?? 'Circle',
      color: body.color ?? '#71717a',
      sort_order: body.sortOrder ?? 0,
    })
    .select(BUDGET_CATEGORY_SELECT_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ category: mapRowToCategory(row) }, { status: 201 })
}, 'POST /api/budget/categories')

export const PATCH = withAuthAndBody(updateBudgetCategorySchema, async (_req, { supabase, user, body }) => {
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.icon !== undefined) updates.icon = body.icon
  if (body.color !== undefined) updates.color = body.color
  if (body.sortOrder !== undefined) updates.sort_order = body.sortOrder

  const { data: row, error } = await supabase
    .from('budget_categories')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', user.id)
    .select(BUDGET_CATEGORY_SELECT_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ category: mapRowToCategory(row) })
}, 'PATCH /api/budget/categories')

export const DELETE = withAuthAndBody(deleteBudgetCategorySchema, async (_req, { supabase, user, body }) => {
  const { error } = await supabase
    .from('budget_categories')
    .delete()
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}, 'DELETE /api/budget/categories')
