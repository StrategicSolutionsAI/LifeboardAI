'use client'

import { useState } from 'react'
import { X, Plus, Trash2, Pencil } from 'lucide-react'
import * as Icons from 'lucide-react'
import { card, button, form } from '@/lib/styles'
import type { BudgetCategory } from '@/types/budget'

interface Props {
  categories: BudgetCategory[]
  onAdd: (data: { name: string; icon?: string; color?: string }) => Promise<void>
  onUpdate: (data: { id: string; name?: string; icon?: string; color?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

function getCategoryIcon(iconName: string) {
  const Icon = (Icons as any)[iconName]
  return Icon ?? Icons.Circle
}

const ICON_OPTIONS = [
  'Home', 'ShoppingCart', 'Car', 'Zap', 'Shield', 'Heart',
  'UtensilsCrossed', 'Film', 'ShoppingBag', 'Sparkles',
  'GraduationCap', 'CreditCard', 'PiggyBank', 'Gift',
  'MoreHorizontal', 'Circle', 'Briefcase', 'Plane',
  'Phone', 'Music', 'Dumbbell', 'Dog',
]

const COLOR_OPTIONS = [
  '#6366f1', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ef4444', '#f97316', '#ec4899', '#14b8a6', '#a855f7',
  '#0ea5e9', '#64748b', '#10b981', '#e11d48', '#71717a',
]

export function CategoryManager({ categories, onAdd, onUpdate, onDelete, onClose }: Props) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Circle')
  const [color, setColor] = useState('#6366f1')
  const [saving, setSaving] = useState(false)

  const startAdd = () => {
    setIsAdding(true)
    setEditingId(null)
    setName('')
    setIcon('Circle')
    setColor('#6366f1')
  }

  const startEdit = (cat: BudgetCategory) => {
    setIsAdding(false)
    setEditingId(cat.id)
    setName(cat.name)
    setIcon(cat.icon)
    setColor(cat.color)
  }

  const cancelForm = () => {
    setIsAdding(false)
    setEditingId(null)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        await onUpdate({ id: editingId, name: name.trim(), icon, color })
      } else {
        await onAdd({ name: name.trim(), icon, color })
      }
      cancelForm()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category? All associated expenses and budgets will also be deleted.')) return
    await onDelete(id)
  }

  const showForm = isAdding || editingId !== null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className={`${card.panel} w-full max-w-lg mx-0 sm:mx-4 rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-neutral-300/50 shrink-0">
          <h2 className="text-lg font-semibold text-theme-text-primary">Manage Categories</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-theme-surface-alt">
            <X className="w-5 h-5 text-theme-text-tertiary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Category list */}
          <div className="space-y-2 mb-4">
            {categories.map((cat) => {
              const Icon = getCategoryIcon(cat.icon)
              return (
                <div key={cat.id} className="flex items-center gap-3 py-2 group">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: cat.color + '20', color: cat.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="flex-1 text-sm text-theme-text-primary">{cat.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(cat)}
                      className="p-1.5 rounded hover:bg-theme-surface-alt text-theme-text-tertiary"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-theme-text-tertiary hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add/Edit form */}
          {showForm ? (
            <div className="border border-theme-neutral-300/50 rounded-xl p-4 space-y-3">
              <div>
                <label className={form.label}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={form.input}
                  placeholder="Category name"
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div>
                <label className={form.label}>Icon</label>
                <div className="flex flex-wrap gap-1.5">
                  {ICON_OPTIONS.map((iconName) => {
                    const Ic = getCategoryIcon(iconName)
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setIcon(iconName)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          icon === iconName
                            ? 'border-theme-primary bg-theme-brand-tint-subtle'
                            : 'border-transparent hover:bg-theme-surface-alt'
                        }`}
                      >
                        <Ic className="w-4 h-4 text-theme-text-secondary" />
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className={form.label}>Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        color === c ? 'border-theme-primary scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={cancelForm} className={`${button.ghost} flex-1`}>
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className={`${button.brand} flex-1`}
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={startAdd}
              className={`${button.ghost} w-full flex items-center justify-center gap-2`}
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
