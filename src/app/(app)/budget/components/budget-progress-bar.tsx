'use client'

import { progress as progressStyles } from '@/lib/styles'
import { getBudgetProgressFillClass } from '@/lib/budget-utils'

interface Props {
  percentUsed: number
  size?: 'sm' | 'md'
  className?: string
}

export function BudgetProgressBar({ percentUsed, size = 'md', className = '' }: Props) {
  const clampedWidth = Math.min(Math.max(percentUsed, 0), 100)
  const trackClass = size === 'sm' ? progressStyles.trackSm : progressStyles.track

  return (
    <div className={`${trackClass} ${className}`}>
      <div
        className={getBudgetProgressFillClass(percentUsed)}
        style={{ width: `${clampedWidth}%` }}
      />
    </div>
  )
}
