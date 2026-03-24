'use client'

import React from 'react'
import Link from 'next/link'
import { useBudgetSummary } from '@/hooks/use-budget'
import { formatCurrency, getBudgetProgressFillClass } from '@/lib/budget-utils'
import { progress as progressStyles, badge } from '@/lib/styles'
import type { WidgetInstance } from '@/types/widgets'

interface Props {
  widget: WidgetInstance
}

export function BudgetWidgetCard({ widget }: Props) {
  const { data, loading } = useBudgetSummary()
  const summary = data?.summary

  if (loading) {
    return (
      <div className="mt-2 space-y-2 animate-pulse">
        <div className="h-4 w-24 rounded bg-theme-brand-tint-subtle" />
        <div className="h-2 w-full rounded bg-theme-brand-tint-subtle" />
        <div className="h-3 w-16 rounded bg-theme-brand-tint-subtle" />
      </div>
    )
  }

  if (!summary || (summary.totalBudget === 0 && summary.totalSpent === 0)) {
    return (
      <div className="mt-3 text-center">
        <div className="text-xs text-theme-text-subtle mb-1">No budget set up</div>
        <Link
          href="/budget"
          className="text-xs text-theme-primary hover:underline"
        >
          Set up your budget
        </Link>
      </div>
    )
  }

  const pct = summary.totalBudget > 0
    ? Math.min(Math.round((summary.totalSpent / summary.totalBudget) * 100), 120)
    : 0

  // Top 3 categories by spending
  const top3 = [...summary.categories]
    .filter((c) => c.spentAmount > 0)
    .sort((a, b) => b.spentAmount - a.spentAmount)
    .slice(0, 3)

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-theme-text-primary">
          {formatCurrency(summary.totalSpent)}
        </span>
        <span className="text-xs text-theme-text-tertiary">
          / {formatCurrency(summary.totalBudget)}
        </span>
      </div>

      <div className={progressStyles.trackSm}>
        <div
          className={getBudgetProgressFillClass(pct)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {top3.length > 0 && (
        <div className="mt-2 space-y-1">
          {top3.map((c) => (
            <div key={c.category.id} className="flex items-center justify-between">
              <span className="text-xs text-theme-text-secondary truncate max-w-[60%]">
                {c.category.name}
              </span>
              <span className="text-xs text-theme-text-tertiary">
                {formatCurrency(c.spentAmount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/budget"
        className="block mt-2 text-xs text-theme-primary hover:underline text-center"
      >
        View Budget
      </Link>
    </div>
  )
}
