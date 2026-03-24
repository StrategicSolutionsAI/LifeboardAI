'use client'

import { useCallback } from 'react'
import { useDataCache } from '@/hooks/use-data-cache'
import { toMonthKey } from '@/lib/budget-utils'
import type {
  BudgetCategory,
  BudgetExpense,
  MonthlyBudgetSummary,
} from '@/types/budget'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

async function mutate<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

export function useBudget(month: string) {
  const summaryCache = useDataCache<{ summary: MonthlyBudgetSummary }>(
    `budget-summary-${month}`,
    () => fetchJson(`/api/budget/summary?month=${month}`),
  )

  const categoriesCache = useDataCache<{ categories: BudgetCategory[] }>(
    'budget-categories',
    () => fetchJson('/api/budget/categories'),
  )

  const expensesCache = useDataCache<{ expenses: BudgetExpense[] }>(
    `budget-expenses-${month}`,
    () => fetchJson(`/api/budget/expenses?month=${month}`),
  )

  const invalidateAll = useCallback(() => {
    summaryCache.invalidate()
    expensesCache.invalidate()
  }, [summaryCache, expensesCache])

  // ── Expense mutations ──────────────────────────────────────────────

  const addExpense = useCallback(
    async (data: { categoryId: string; amount: number; date?: string; note?: string | null }) => {
      await mutate('/api/budget/expenses', 'POST', data)
      invalidateAll()
    },
    [invalidateAll],
  )

  const updateExpense = useCallback(
    async (data: { id: string; categoryId?: string; amount?: number; date?: string; note?: string | null }) => {
      await mutate('/api/budget/expenses', 'PATCH', data)
      invalidateAll()
    },
    [invalidateAll],
  )

  const deleteExpense = useCallback(
    async (id: string) => {
      await mutate('/api/budget/expenses', 'DELETE', { id })
      invalidateAll()
    },
    [invalidateAll],
  )

  // ── Budget mutations ───────────────────────────────────────────────

  const upsertBudget = useCallback(
    async (data: { categoryId: string; month: string; amount: number }) => {
      await mutate('/api/budget/monthly', 'POST', data)
      summaryCache.invalidate()
    },
    [summaryCache],
  )

  // ── Category mutations ─────────────────────────────────────────────

  const addCategory = useCallback(
    async (data: { name: string; icon?: string; color?: string }) => {
      await mutate('/api/budget/categories', 'POST', data)
      categoriesCache.invalidate()
      summaryCache.invalidate()
    },
    [categoriesCache, summaryCache],
  )

  const updateCategory = useCallback(
    async (data: { id: string; name?: string; icon?: string; color?: string; sortOrder?: number }) => {
      await mutate('/api/budget/categories', 'PATCH', data)
      categoriesCache.invalidate()
      summaryCache.invalidate()
    },
    [categoriesCache, summaryCache],
  )

  const deleteCategory = useCallback(
    async (id: string) => {
      await mutate('/api/budget/categories', 'DELETE', { id })
      categoriesCache.invalidate()
      invalidateAll()
    },
    [categoriesCache, invalidateAll],
  )

  return {
    summary: summaryCache.data?.summary ?? null,
    summaryLoading: summaryCache.loading,
    categories: categoriesCache.data?.categories ?? [],
    categoriesLoading: categoriesCache.loading,
    expenses: expensesCache.data?.expenses ?? [],
    expensesLoading: expensesCache.loading,
    addExpense,
    updateExpense,
    deleteExpense,
    upsertBudget,
    addCategory,
    updateCategory,
    deleteCategory,
    invalidateAll,
  }
}

/** Standalone summary fetcher for the widget card */
export function useBudgetSummary(month?: string) {
  const m = month ?? toMonthKey(new Date())
  return useDataCache<{ summary: MonthlyBudgetSummary }>(
    `budget-summary-${m}`,
    () => fetchJson(`/api/budget/summary?month=${m}`),
  )
}
