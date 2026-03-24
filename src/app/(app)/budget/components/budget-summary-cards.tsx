'use client'

import { DollarSign, TrendingDown, Wallet, Activity } from 'lucide-react'
import { card } from '@/lib/styles'
import { formatCurrency } from '@/lib/budget-utils'
import type { MonthlyBudgetSummary } from '@/types/budget'

interface Props {
  summary: MonthlyBudgetSummary
}

export function BudgetSummaryCards({ summary }: Props) {
  const stats = [
    {
      label: 'Total Budget',
      value: formatCurrency(summary.totalBudget),
      icon: Wallet,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Total Spent',
      value: formatCurrency(summary.totalSpent),
      icon: DollarSign,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Remaining',
      value: formatCurrency(summary.totalRemaining),
      icon: TrendingDown,
      color: summary.totalRemaining >= 0 ? 'text-emerald-600' : 'text-red-600',
      bg: summary.totalRemaining >= 0 ? 'bg-emerald-50' : 'bg-red-50',
    },
    {
      label: 'Health Score',
      value: `${summary.healthScore}%`,
      icon: Activity,
      color: summary.healthScore >= 50 ? 'text-emerald-600' : 'text-red-600',
      bg: summary.healthScore >= 50 ? 'bg-emerald-50' : 'bg-red-50',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`${card.base} flex items-center gap-3 px-4 py-3`}
        >
          <div className={`${s.bg} ${s.color} p-2 rounded-lg shrink-0`}>
            <s.icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold text-theme-text-primary truncate">{s.value}</div>
            <div className="text-xs text-theme-text-tertiary">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
