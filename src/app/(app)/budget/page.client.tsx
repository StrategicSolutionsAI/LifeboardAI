'use client'

import { PageHeaderActions } from "@/components/page-header-actions"
import { useState, useCallback } from 'react'
import { Plus, Settings } from 'lucide-react'
import { useBudget } from '@/hooks/use-budget'
import { toMonthKey } from '@/lib/budget-utils'
import { button } from '@/lib/styles'
import { MonthSelector } from './components/month-selector'
import { BudgetSummaryCards } from './components/budget-summary-cards'
import { CategoryBudgetList } from './components/category-budget-list'
import { ExpenseList } from './components/expense-list'
import { AddExpenseModal } from './components/add-expense-modal'
import { CategoryManager } from './components/category-manager'
import type { BudgetExpense } from '@/types/budget'

export default function BudgetPageClient() {
  const [month, setMonth] = useState(() => toMonthKey(new Date()))
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [editingExpense, setEditingExpense] = useState<BudgetExpense | null>(null)
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null)

  const {
    summary,
    summaryLoading,
    categories,
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    upsertBudget,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useBudget(month)

  const handleEditExpense = useCallback((expense: BudgetExpense) => {
    setEditingExpense(expense)
    setShowAddExpense(true)
  }, [])

  const handleCloseExpenseModal = useCallback(() => {
    setShowAddExpense(false)
    setEditingExpense(null)
  }, [])

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <MonthSelector month={month} onChange={setMonth} />
        <PageHeaderActions>
          <button
            onClick={() => setShowCategoryManager(true)}
            className="p-2 rounded-lg hover:bg-theme-surface-alt transition-colors"
            title="Manage categories"
          >
            <Settings className="w-5 h-5 text-theme-text-secondary" />
          </button>
          <button
            onClick={() => setShowAddExpense(true)}
            className={`${button.brand} flex items-center gap-1.5`}
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </PageHeaderActions>
      </div>

      {/* Summary cards */}
      {summary && !summaryLoading && (
        <BudgetSummaryCards summary={summary} />
      )}
      {summaryLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-theme-neutral-300/80 bg-white">
              <div className="h-9 w-9 rounded-lg bg-theme-brand-tint-subtle shrink-0" />
              <div className="flex flex-col gap-1">
                <div className="h-5 w-16 rounded bg-theme-brand-tint-light" />
                <div className="h-3 w-12 rounded bg-theme-brand-tint-subtle" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CategoryBudgetList
            categories={summary?.categories ?? []}
            month={month}
            onUpsertBudget={upsertBudget}
          />
        </div>
        <div>
          <ExpenseList
            expenses={expenses}
            categories={categories}
            onDelete={deleteExpense}
            onEdit={handleEditExpense}
            filterCategoryId={filterCategoryId}
            onFilterChange={setFilterCategoryId}
          />
        </div>
      </div>

      {/* Modals */}
      {showAddExpense && (
        <AddExpenseModal
          categories={categories}
          onSubmit={addExpense}
          onUpdate={updateExpense}
          editingExpense={editingExpense}
          onClose={handleCloseExpenseModal}
        />
      )}
      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          onAdd={addCategory}
          onUpdate={updateCategory}
          onDelete={deleteCategory}
          onClose={() => setShowCategoryManager(false)}
        />
      )}
    </div>
  )
}
