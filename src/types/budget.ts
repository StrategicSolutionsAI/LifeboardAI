export interface BudgetCategory {
  id: string
  userId: string
  name: string
  icon: string      // Lucide icon name
  color: string     // hex color
  isDefault: boolean
  sortOrder: number
  createdAt: string
}

export interface MonthlyBudget {
  id: string
  userId: string
  categoryId: string
  month: string     // YYYY-MM-DD (first of month)
  amount: number
  createdAt: string
  updatedAt: string
}

export interface BudgetExpense {
  id: string
  userId: string
  categoryId: string
  amount: number
  date: string      // YYYY-MM-DD
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface CategoryBudgetSummary {
  category: BudgetCategory
  budgetAmount: number
  spentAmount: number
  remainingAmount: number
  percentUsed: number
  healthLevel: BudgetHealthLevel
}

export interface MonthlyBudgetSummary {
  month: string       // YYYY-MM-DD (first of month)
  totalBudget: number
  totalSpent: number
  totalRemaining: number
  healthScore: number // 0-100
  categories: CategoryBudgetSummary[]
}

export type BudgetHealthLevel = 'healthy' | 'warning' | 'danger' | 'over'

export function getBudgetHealthLevel(percentUsed: number): BudgetHealthLevel {
  if (percentUsed > 100) return 'over'
  if (percentUsed >= 90) return 'danger'
  if (percentUsed >= 70) return 'warning'
  return 'healthy'
}

export const DEFAULT_BUDGET_CATEGORIES = [
  { name: 'Housing', icon: 'Home', color: '#6366f1' },
  { name: 'Groceries', icon: 'ShoppingCart', color: '#22c55e' },
  { name: 'Transportation', icon: 'Car', color: '#3b82f6' },
  { name: 'Utilities', icon: 'Zap', color: '#f59e0b' },
  { name: 'Insurance', icon: 'Shield', color: '#8b5cf6' },
  { name: 'Healthcare', icon: 'Heart', color: '#ef4444' },
  { name: 'Dining Out', icon: 'UtensilsCrossed', color: '#f97316' },
  { name: 'Entertainment', icon: 'Film', color: '#ec4899' },
  { name: 'Shopping', icon: 'ShoppingBag', color: '#14b8a6' },
  { name: 'Personal Care', icon: 'Sparkles', color: '#a855f7' },
  { name: 'Education', icon: 'GraduationCap', color: '#0ea5e9' },
  { name: 'Subscriptions', icon: 'CreditCard', color: '#64748b' },
  { name: 'Savings', icon: 'PiggyBank', color: '#10b981' },
  { name: 'Gifts & Donations', icon: 'Gift', color: '#e11d48' },
  { name: 'Miscellaneous', icon: 'MoreHorizontal', color: '#71717a' },
] as const
