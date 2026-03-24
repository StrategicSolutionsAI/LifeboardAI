'use client'

import React from 'react'
import Link from 'next/link'
import { useBudgetSummary } from '@/hooks/use-budget'
import { formatCurrency, getBudgetProgressFillClass } from '@/lib/budget-utils'
import { progress as progressStyles, badge, card, button } from '@/lib/styles'
import type { WidgetInstance } from '@/types/widgets'

interface Props {
  widget: WidgetInstance
  onUpdate: (updates: Partial<WidgetInstance>) => void
}

export function BudgetWidgetModal({ widget }: Props) {
  const { data, loading } = useBudgetSummary()
  const summary = data?.summary

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${card.stat} p-4`}>
              <div className="h-3 w-16 rounded bg-theme-brand-tint-subtle mb-2" />
              <div className="h-6 w-20 rounded bg-theme-brand-tint-light" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!summary || (summary.totalBudget === 0 && summary.totalSpent === 0)) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-theme-text-secondary mb-4">
          No budget set up yet. Head to the budget page to get started.
        </p>
        <Link href="/budget" className={button.brand}>
          Set Up Budget
        </Link>
      </div>
    )
  }

  const pct = summary.totalBudget > 0
    ? Math.round((summary.totalSpent / summary.totalBudget) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`${card.stat} p-4`}>
          <div className="text-xs text-theme-text-tertiary">Total Budget</div>
          <div className="text-lg font-bold text-theme-text-primary">{formatCurrency(summary.totalBudget)}</div>
        </div>
        <div className={`${card.stat} p-4`}>
          <div className="text-xs text-theme-text-tertiary">Total Spent</div>
          <div className="text-lg font-bold text-theme-text-primary">{formatCurrency(summary.totalSpent)}</div>
        </div>
        <div className={`${card.stat} p-4`}>
          <div className="text-xs text-theme-text-tertiary">Remaining</div>
          <div className={`text-lg font-bold ${summary.totalRemaining >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {formatCurrency(summary.totalRemaining)}
          </div>
        </div>
        <div className={`${card.stat} p-4`}>
          <div className="text-xs text-theme-text-tertiary">Health Score</div>
          <div className="text-lg font-bold text-theme-text-primary">{summary.healthScore}%</div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="space-y-3">
        {summary.categories
          .filter((c) => c.budgetAmount > 0 || c.spentAmount > 0)
          .map((c) => {
            const catPct = c.budgetAmount > 0
              ? Math.min(Math.round((c.spentAmount / c.budgetAmount) * 100), 120)
              : 0
            return (
              <div key={c.category.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.category.color }}
                    />
                    <span className="text-sm text-theme-text-primary">{c.category.name}</span>
                  </div>
                  <span className="text-xs text-theme-text-tertiary">
                    {formatCurrency(c.spentAmount)} / {formatCurrency(c.budgetAmount)}
                  </span>
                </div>
                <div className={progressStyles.trackSm}>
                  <div
                    className={getBudgetProgressFillClass(catPct)}
                    style={{ width: `${Math.min(catPct, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
      </div>

      <Link
        href="/budget"
        className={`${button.brand} w-full text-center block`}
      >
        Open Full Page
      </Link>
    </div>
  )
}
