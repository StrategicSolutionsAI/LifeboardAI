'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  month: string // YYYY-MM-01
  onChange: (month: string) => void
}

function parseMonth(month: string): Date {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

function shiftMonth(month: string, delta: number): string {
  const d = parseMonth(month)
  d.setMonth(d.getMonth() + delta)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

export function MonthSelector({ month, onChange }: Props) {
  const d = parseMonth(month)
  const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(shiftMonth(month, -1))}
        className="p-1.5 rounded-lg hover:bg-theme-surface-alt transition-colors"
        aria-label="Previous month"
      >
        <ChevronLeft className="w-5 h-5 text-theme-text-secondary" />
      </button>
      <span className="text-lg font-semibold text-theme-text-primary min-w-[180px] text-center">
        {label}
      </span>
      <button
        onClick={() => onChange(shiftMonth(month, 1))}
        className="p-1.5 rounded-lg hover:bg-theme-surface-alt transition-colors"
        aria-label="Next month"
      >
        <ChevronRight className="w-5 h-5 text-theme-text-secondary" />
      </button>
    </div>
  )
}
