import { progress } from '@/lib/styles'

/**
 * Returns the progress bar fill class based on budget usage percentage.
 * For budgets: green when low usage, amber when approaching limit, red near/over.
 */
export function getBudgetProgressFillClass(percentUsed: number): string {
  if (percentUsed > 100) return progress.fill.over
  if (percentUsed >= 90) return progress.fill.low    // red — danger
  if (percentUsed >= 70) return progress.fill.medium  // amber — warning
  return progress.fill.high                            // green — healthy
}

/** Format a number as USD currency */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Compute health score 0-100 (100 = no spending, 0 = fully over) */
export function computeHealthScore(totalBudget: number, totalSpent: number): number {
  if (totalBudget <= 0) return totalSpent > 0 ? 0 : 100
  const ratio = totalSpent / totalBudget
  return Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)))
}

/** Convert a Date to a YYYY-MM-01 string for month keys */
export function toMonthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}
