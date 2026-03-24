'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { button, form, card } from '@/lib/styles'
import type { BudgetCategory, BudgetExpense } from '@/types/budget'

interface Props {
  categories: BudgetCategory[]
  onSubmit: (data: { categoryId: string; amount: number; date?: string; note?: string | null }) => Promise<void>
  onUpdate?: (data: { id: string; categoryId?: string; amount?: number; date?: string; note?: string | null }) => Promise<void>
  editingExpense?: BudgetExpense | null
  onClose: () => void
}

export function AddExpenseModal({ categories, onSubmit, onUpdate, editingExpense, onClose }: Props) {
  const isEdit = Boolean(editingExpense)
  const [categoryId, setCategoryId] = useState(editingExpense?.categoryId ?? (categories[0]?.id ?? ''))
  const [amount, setAmount] = useState(editingExpense ? String(editingExpense.amount) : '')
  const [date, setDate] = useState(editingExpense?.date ?? new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState(editingExpense?.note ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0 || !categoryId) return

    setSaving(true)
    try {
      if (isEdit && editingExpense && onUpdate) {
        await onUpdate({
          id: editingExpense.id,
          categoryId,
          amount: parsedAmount,
          date,
          note: note || null,
        })
      } else {
        await onSubmit({ categoryId, amount: parsedAmount, date, note: note || null })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className={`${card.panel} w-full max-w-md mx-4 p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-theme-text-primary">
            {isEdit ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-theme-surface-alt">
            <X className="w-5 h-5 text-theme-text-tertiary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={form.label}>Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-tertiary text-sm">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${form.input} pl-7`}
                placeholder="0.00"
                step="0.01"
                min="0.01"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className={form.label}>Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={form.select}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={form.label}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={form.input}
              required
            />
          </div>

          <div>
            <label className={form.label}>Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={form.input}
              placeholder="e.g. Weekly groceries"
              maxLength={500}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`${button.ghost} flex-1`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !amount || parseFloat(amount) <= 0}
              className={`${button.brand} flex-1`}
            >
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
