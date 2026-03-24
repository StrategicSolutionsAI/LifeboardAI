'use client'

import { useState } from 'react'
import * as Icons from 'lucide-react'
import { card } from '@/lib/styles'
import { formatCurrency } from '@/lib/budget-utils'
import { BudgetProgressBar } from './budget-progress-bar'
import type { CategoryBudgetSummary } from '@/types/budget'

interface Props {
  categories: CategoryBudgetSummary[]
  month: string
  onUpsertBudget: (data: { categoryId: string; month: string; amount: number }) => Promise<void>
}

function getCategoryIcon(iconName: string) {
  const Icon = (Icons as any)[iconName]
  return Icon ?? Icons.Circle
}

export function CategoryBudgetList({ categories, month, onUpsertBudget }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const handleStartEdit = (cat: CategoryBudgetSummary) => {
    setEditingId(cat.category.id)
    setEditValue(cat.budgetAmount > 0 ? String(cat.budgetAmount) : '')
  }

  const handleSave = async (categoryId: string) => {
    const amount = parseFloat(editValue) || 0
    setSaving(true)
    try {
      await onUpsertBudget({ categoryId, month, amount })
    } finally {
      setSaving(false)
      setEditingId(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, categoryId: string) => {
    if (e.key === 'Enter') handleSave(categoryId)
    if (e.key === 'Escape') setEditingId(null)
  }

  if (categories.length === 0) {
    return (
      <div className={`${card.base} p-6 text-center`}>
        <p className="text-sm text-theme-text-secondary">No categories yet.</p>
      </div>
    )
  }

  return (
    <div className={`${card.base} divide-y divide-theme-neutral-300/50`}>
      <div className="px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-theme-text-primary">Categories</h3>
        <span className="text-xs text-theme-text-tertiary">{categories.length} categories</span>
      </div>
      {categories.map((c) => {
        const Icon = getCategoryIcon(c.category.icon)
        const isEditing = editingId === c.category.id
        return (
          <div key={c.category.id} className="px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: c.category.color + '20', color: c.category.color }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-theme-text-primary truncate">
                  {c.category.name}
                </div>
                <div className="text-xs text-theme-text-tertiary">
                  {formatCurrency(c.spentAmount)} spent
                </div>
              </div>
              <div className="text-right shrink-0">
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-theme-text-tertiary">$</span>
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, c.category.id)}
                      onBlur={() => handleSave(c.category.id)}
                      className="w-20 text-sm text-right border border-theme-neutral-300 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-theme-primary"
                      autoFocus
                      disabled={saving}
                      min={0}
                      step={1}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartEdit(c)}
                    className="text-sm font-medium text-theme-text-primary hover:text-theme-primary transition-colors"
                    title="Click to edit budget"
                  >
                    {c.budgetAmount > 0 ? formatCurrency(c.budgetAmount) : 'Set budget'}
                  </button>
                )}
              </div>
            </div>
            {c.budgetAmount > 0 && (
              <BudgetProgressBar percentUsed={c.percentUsed} size="sm" />
            )}
          </div>
        )
      })}
    </div>
  )
}
