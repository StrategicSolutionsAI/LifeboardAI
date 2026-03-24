'use client'

import { useState } from 'react'
import { Trash2, Pencil } from 'lucide-react'
import { card } from '@/lib/styles'
import { formatCurrency } from '@/lib/budget-utils'
import type { BudgetExpense, BudgetCategory } from '@/types/budget'

interface Props {
  expenses: BudgetExpense[]
  categories: BudgetCategory[]
  onDelete: (id: string) => Promise<void>
  onEdit: (expense: BudgetExpense) => void
  filterCategoryId: string | null
  onFilterChange: (categoryId: string | null) => void
}

export function ExpenseList({
  expenses,
  categories,
  onDelete,
  onEdit,
  filterCategoryId,
  onFilterChange,
}: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  const filtered = filterCategoryId
    ? expenses.filter((e) => e.categoryId === filterCategoryId)
    : expenses

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await onDelete(id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className={`${card.base} flex flex-col`}>
      <div className="px-4 py-3 flex items-center justify-between border-b border-theme-neutral-300/50">
        <h3 className="text-sm font-semibold text-theme-text-primary">Expenses</h3>
        <select
          value={filterCategoryId ?? ''}
          onChange={(e) => onFilterChange(e.target.value || null)}
          className="text-xs border border-theme-neutral-300 rounded px-2 py-1 bg-white text-theme-text-secondary focus:outline-none focus:ring-1 focus:ring-theme-primary"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-theme-text-secondary">No expenses this month</p>
        </div>
      ) : (
        <div className="divide-y divide-theme-neutral-300/50 max-h-[400px] overflow-y-auto">
          {filtered.map((e) => {
            const cat = categoryMap.get(e.categoryId)
            return (
              <div key={e.id} className="px-4 py-2.5 flex items-center gap-3 group">
                {cat && (
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-theme-text-primary truncate">
                    {e.note || cat?.name || 'Expense'}
                  </div>
                  <div className="text-xs text-theme-text-tertiary">
                    {new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {cat && e.note ? ` \u00b7 ${cat.name}` : ''}
                  </div>
                </div>
                <span className="text-sm font-medium text-theme-text-primary shrink-0">
                  {formatCurrency(e.amount)}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => onEdit(e)}
                    className="p-1 rounded hover:bg-theme-surface-alt text-theme-text-tertiary hover:text-theme-text-primary transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    disabled={deletingId === e.id}
                    className="p-1 rounded hover:bg-red-50 text-theme-text-tertiary hover:text-red-500 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
