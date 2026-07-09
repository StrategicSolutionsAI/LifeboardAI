import {
  Home, ShoppingCart, Car, Zap, Shield, Heart,
  UtensilsCrossed, Film, ShoppingBag, Sparkles,
  GraduationCap, CreditCard, PiggyBank, Gift,
  MoreHorizontal, Circle, Briefcase, Plane,
  Phone, Music, Dumbbell, Dog,
  type LucideIcon,
} from 'lucide-react'

// Every icon a budget category can reference, as named imports. A namespace
// import (`import * as Icons from 'lucide-react'`) defeats tree-shaking and
// added ~150 kB of route JS to /budget.
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Home, ShoppingCart, Car, Zap, Shield, Heart,
  UtensilsCrossed, Film, ShoppingBag, Sparkles,
  GraduationCap, CreditCard, PiggyBank, Gift,
  MoreHorizontal, Circle, Briefcase, Plane,
  Phone, Music, Dumbbell, Dog,
}

// Picker order matches the map's insertion order (unchanged from the old list)
export const ICON_OPTIONS = Object.keys(CATEGORY_ICONS)

export function getCategoryIcon(iconName: string): LucideIcon {
  return CATEGORY_ICONS[iconName] ?? Circle
}
