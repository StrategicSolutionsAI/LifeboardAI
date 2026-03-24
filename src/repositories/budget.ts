import type { BudgetCategory, MonthlyBudget, BudgetExpense } from '@/types/budget'

export const BUDGET_CATEGORY_SELECT_COLUMNS =
  ['id', 'user_id', 'name', 'icon', 'color', 'is_default', 'sort_order', 'created_at'].join(', ')

export const MONTHLY_BUDGET_SELECT_COLUMNS =
  ['id', 'user_id', 'category_id', 'month', 'amount', 'created_at', 'updated_at'].join(', ')

export const BUDGET_EXPENSE_SELECT_COLUMNS =
  ['id', 'user_id', 'category_id', 'amount', 'date', 'note', 'created_at', 'updated_at'].join(', ')

export function mapRowToCategory(row: any): BudgetCategory {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    icon: row.icon as string,
    color: row.color as string,
    isDefault: Boolean(row.is_default),
    sortOrder: Number(row.sort_order),
    createdAt: row.created_at as string,
  }
}

export function mapRowToBudget(row: any): MonthlyBudget {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    categoryId: row.category_id as string,
    month: row.month as string,
    amount: Number(row.amount),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function mapRowToExpense(row: any): BudgetExpense {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    categoryId: row.category_id as string,
    amount: Number(row.amount),
    date: row.date as string,
    note: row.note ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
