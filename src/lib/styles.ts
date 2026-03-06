/**
 * =============================================================================
 * LifeboardAI Style Library
 * =============================================================================
 *
 * Centralized Tailwind class tokens for consistent UI across the application.
 * All tokens reference CSS variables from globals.css via Tailwind mappings in
 * tailwind.config.ts, ensuring theme changes propagate automatically.
 *
 * USAGE:
 *   import { card, text, surface, elevation, layout } from '@/lib/styles'
 *   <div className={cn(card.base, layout.padding.standard)}>
 *
 * ---------------------------------------------------------------------------
 * STYLE GUIDE — Design Decisions
 * ---------------------------------------------------------------------------
 *
 * BORDER RADIUS (by element type):
 *   - Card / container:  rounded-xl   (card.base, card.stat, card.interactive)
 *   - Modal / sheet:     rounded-2xl  (card.panel)
 *   - Button / input:    rounded-lg   (form.input, button.*)
 *   - Badge:             rounded-md   (badge.base) or rounded-full (badge.pill)
 *   - Icon box:          rounded-lg   (iconBox.*)
 *   - Pill / chip:       rounded-full (badge.count)
 *
 * SHADOW HIERARCHY (lightest → heaviest):
 *   none → micro → xs → warm-sm → warm → warm-lg → popover
 *   Use elevation tokens which pair shadow + border for consistency.
 *
 * TYPOGRAPHY HIERARCHY (largest → smallest):
 *   pageTitle → heading.2xl → heading.xl → heading.lg → heading.md →
 *   heading.sm → heading.xs → size.lg → size.md → size.sm → caption
 *
 *   Stat-specific: metric (3xl black) > statValue (lg bold) > unit (sm medium)
 *
 * SPACING SCALE:
 *   compact:  p-3, gap-3        (tight cards, compact lists)
 *   standard: p-4, gap-4        (default card padding, grid gaps)
 *   spacious: p-5, gap-5        (section content with breathing room)
 *   section:  p-4 sm:p-6, gap-6 (page-level sections, responsive)
 *
 * WARM-TINT SURFACES (opacity scale):
 *   30 → 50 → 60 → 70 → 80 → 90 → 100
 *   Used for: weekend cells (60), inactive tabs (90), hover states (50),
 *   off-month cells (30), page backgrounds (70)
 *
 * STATUS TINT COLORS:
 *   info (blue) / success (green) / warning (amber) / error (red)
 *   Used for stat card icon backgrounds at 15% opacity.
 * =============================================================================
 */

// -----------------------------------------------------------------------------
// TEXT — Color hierarchy + typography presets
// -----------------------------------------------------------------------------

export const text = {
  // Color-only tokens (pair with a size/weight class)
  primary: 'text-theme-text-primary',
  secondary: 'text-theme-text-secondary',
  tertiary: 'text-theme-text-tertiary',
  subtle: 'text-theme-text-subtle',
  body: 'text-theme-text-body',
  quaternary: 'text-theme-text-quaternary',
  inverse: 'text-theme-text-inverse',
  brand: 'text-theme-primary',
  brandAlt: 'text-theme-secondary',
  accent: 'text-theme-primary-600',

  // Heading presets (size + weight, no color — compose with a color token)
  heading: {
    '2xl': 'text-[28px] font-semibold leading-tight',
    xl: 'text-2xl font-semibold leading-tight',
    lg: 'text-xl font-semibold leading-tight',
    md: 'text-lg font-semibold leading-snug',
    sm: 'text-base font-semibold leading-snug',
    xs: 'text-sm font-semibold leading-snug',
  },

  // Body presets (size + weight, no color)
  size: {
    lg: 'text-base font-normal leading-relaxed',
    md: 'text-sm font-normal leading-normal',
    sm: 'text-xs font-normal leading-normal',
  },

  // Composed presets (size + weight + color — ready to use as-is)
  pageTitle: 'text-[24px] font-semibold tracking-tight text-theme-text-primary',
  label: 'text-[11px] font-semibold uppercase tracking-widest text-theme-text-subtle',
  sectionLabel: 'text-xs font-semibold uppercase tracking-wide text-theme-secondary',
  metric: 'text-3xl font-black leading-none tracking-tight text-theme-text-primary',
  metricLg: 'text-4xl font-black leading-none tracking-tight text-theme-text-primary',
  statValue: 'text-[28px] leading-none text-theme-text-primary',
  unit: 'text-sm font-medium text-theme-text-tertiary',
  caption: 'text-[10px] font-medium text-theme-text-tertiary',
  tableHeader: 'text-[11px] font-medium tracking-wide uppercase text-theme-text-tertiary',
} as const

// -----------------------------------------------------------------------------
// SURFACE — Background tokens
// -----------------------------------------------------------------------------

export const surface = {
  base: 'bg-theme-surface-base',
  raised: 'bg-theme-surface-raised',
  sunken: 'bg-theme-surface-sunken',
  overlay: 'bg-theme-surface-overlay',
  alt: 'bg-theme-surface-alt',
  warmTint: 'bg-theme-primary-50',
  skeleton: 'bg-theme-skeleton',
  progressTrack: 'bg-theme-progress-track',
  selected: 'bg-theme-surface-selected',
  page: 'bg-theme-surface-alt',

  // Warm-tint opacity scale (for backgrounds with warm paper-like feel)
  warm30: 'bg-theme-surface-warm-30',
  warm50: 'bg-theme-surface-warm-50',
  warm60: 'bg-theme-surface-warm-60',
  warm70: 'bg-theme-surface-warm-70',
  warm80: 'bg-theme-surface-warm-80',
  warm90: 'bg-theme-surface-warm-90',
  warm: 'bg-theme-surface-warm',

  // Status tints (icon/stat card backgrounds)
  infoTint: 'bg-theme-info-tint',
  successTint: 'bg-theme-success-tint',
  warningTint: 'bg-theme-warning-tint',
  errorTint: 'bg-theme-error-tint',
} as const

// -----------------------------------------------------------------------------
// BORDER — Border color tokens
// -----------------------------------------------------------------------------

export const border = {
  default: 'border-theme-neutral-300',
  subtle: 'border-theme-neutral-300/50',
  strong: 'border-theme-neutral-300/80',
  brand: 'border-theme-primary-400',
  focus: 'border-theme-secondary',
  divider: 'border-t border-theme-neutral-300',

  // Opacity variants (for warm-tinted borders)
  subtle60: 'border-theme-border-subtle-60',
  subtle70: 'border-theme-border-subtle-70',
  subtle90: 'border-theme-border-subtle-90',
} as const

// -----------------------------------------------------------------------------
// ELEVATION — Shadow + border combos
// -----------------------------------------------------------------------------

export const elevation = {
  none: 'shadow-none border border-theme-neutral-300',
  micro: 'shadow-micro border border-theme-neutral-300',
  xs: 'shadow-xs border border-theme-neutral-300',
  sm: 'shadow-warm-sm border border-theme-neutral-300',
  md: 'shadow-warm border border-theme-neutral-300/80',
  lg: 'shadow-warm-lg border border-theme-neutral-300/60',
  popover: 'shadow-[0px_8px_24px_rgba(163,133,96,0.12)] border border-theme-neutral-300',
} as const

// -----------------------------------------------------------------------------
// CARD — Composed container patterns
// -----------------------------------------------------------------------------

export const card = {
  base: 'rounded-xl bg-theme-surface-raised shadow-warm-sm border border-theme-neutral-300',
  interactive: 'rounded-xl bg-theme-surface-raised shadow-warm-sm border border-theme-neutral-300 hover:shadow-warm cursor-pointer transition-shadow',
  section: 'rounded-xl bg-theme-surface-raised shadow-warm-sm border border-theme-neutral-300 p-4 sm:p-6',
  panel: 'space-y-4 rounded-2xl border border-theme-neutral-300 bg-theme-surface-raised p-4 shadow-warm-sm',
  popover: 'rounded-xl bg-theme-surface-overlay/95 border border-theme-neutral-300 shadow-warm-lg backdrop-blur-sm',
  task: 'group bg-theme-surface-raised rounded-xl border border-theme-neutral-300/80 p-3.5 transition-all cursor-default',
  stat: 'rounded-xl border border-theme-neutral-300 bg-theme-surface-raised p-4 shadow-warm-sm',
  inset: 'rounded-lg bg-theme-surface-alt border border-theme-neutral-300',
} as const

// -----------------------------------------------------------------------------
// LAYOUT — Spacing tokens for padding, gap, and section sizing
// -----------------------------------------------------------------------------

export const layout = {
  padding: {
    compact: 'p-3',
    standard: 'p-4',
    spacious: 'p-5',
    section: 'p-4 sm:p-6',
  },
  gap: {
    compact: 'gap-3',
    standard: 'gap-4',
    spacious: 'gap-5',
    section: 'gap-6',
  },
  px: {
    compact: 'px-3',
    standard: 'px-4',
    spacious: 'px-5',
    section: 'px-4 sm:px-6',
  },
} as const

// -----------------------------------------------------------------------------
// FORM — Form control styles
// -----------------------------------------------------------------------------

export const form = {
  input: 'w-full rounded-lg border border-theme-neutral-300 bg-theme-surface-raised px-3 py-2.5 text-sm text-theme-text-primary shadow-warm-sm transition focus:border-theme-secondary focus:outline-none focus:ring-2 focus:ring-theme-primary/40',
  textarea: 'w-full rounded-lg border border-theme-neutral-300 bg-theme-surface-raised px-3 py-2.5 text-sm text-theme-text-primary shadow-warm-sm transition focus:border-theme-secondary focus:outline-none focus:ring-2 focus:ring-theme-primary/40 min-h-[88px] resize-y',
  label: 'text-[11px] font-semibold uppercase tracking-wide text-theme-text-subtle',
  select: 'w-full rounded-lg border border-theme-neutral-300 bg-theme-surface-raised px-3 py-2.5 text-sm text-theme-text-primary transition focus:border-theme-secondary focus:outline-none focus:ring-2 focus:ring-theme-primary/40',
} as const

// -----------------------------------------------------------------------------
// INTERACTIVE — Hover, focus, transition states
// -----------------------------------------------------------------------------

export const interactive = {
  transition: 'transition-all duration-200 ease-out',
  transitionFast: 'transition-all duration-150 ease-out',
  transitionSlow: 'transition-all duration-300 ease-out',
  hover: 'hover:bg-theme-hover transition-colors',
  hoverBrand: 'hover:bg-theme-brand-tint-light transition-colors duration-150',
  hoverSubtle: 'hover:bg-theme-surface-alt transition-colors',
  hoverWarm: 'hover:bg-theme-surface-warm-50 transition-colors',
  focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/40',
  focusTight: 'focus-visible:outline-none focus-visible:ring-[1px] focus-visible:ring-theme-primary/50',
  active: 'active:scale-[0.98] active:translate-y-0',
  widgetHover: 'hover:shadow-warm-lg hover:scale-[1.02] hover:-translate-y-0.5',
  widgetActive: 'active:scale-[0.98] active:translate-y-0',
  clickable: 'cursor-pointer transition-all duration-200 ease-out hover:bg-theme-brand-tint-light active:scale-[0.98]',
} as const

// -----------------------------------------------------------------------------
// BADGE — Status badge variants
// -----------------------------------------------------------------------------

export const badge = {
  base: 'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium',
  pill: 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border',
  success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  danger: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-theme-surface-selected text-theme-primary-600 border-theme-neutral-300',
  neutral: 'bg-theme-progress-track text-theme-text-primary border-theme-neutral-300',
  count: 'flex items-center justify-center w-4 h-4 rounded-full bg-theme-primary text-white text-[9px] font-bold leading-none',
} as const

// -----------------------------------------------------------------------------
// PROGRESS — Progress bar styles
// -----------------------------------------------------------------------------

export const progress = {
  track: 'w-full rounded-full h-2 bg-theme-progress-track overflow-hidden',
  trackSm: 'w-full rounded-full h-1 bg-theme-progress-track overflow-hidden',
  fill: {
    low: 'h-full rounded-full bg-red-400 transition-all duration-500 ease-out',
    medium: 'h-full rounded-full bg-amber-400 transition-all duration-500 ease-out',
    high: 'h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out',
    complete: 'h-full rounded-full bg-theme-primary transition-all duration-500 ease-out',
    brand: 'h-full rounded-full bg-theme-primary transition-all duration-300',
    over: 'h-full rounded-full bg-purple-500 transition-all duration-500 ease-out',
  },
} as const

// -----------------------------------------------------------------------------
// NAV — Navigation indicator styles
// -----------------------------------------------------------------------------

export const nav = {
  sidebarIndicator: 'absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-theme-primary',
  bottomIndicator: 'absolute top-0 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-theme-primary',
  tabIndicator: 'absolute bottom-0 left-2 right-2 h-[2px] bg-theme-primary rounded-full',
} as const

// -----------------------------------------------------------------------------
// ICON BOX — Icon container sizes
// -----------------------------------------------------------------------------

export const iconBox = {
  sm: 'w-7 h-7 rounded-lg flex items-center justify-center',
  md: 'w-9 h-9 rounded-lg flex items-center justify-center',
  lg: 'w-10 h-10 rounded-lg flex items-center justify-center',
} as const

// -----------------------------------------------------------------------------
// BUTTON — Supplemental button styles (beyond shadcn Button variants)
// -----------------------------------------------------------------------------

export const button = {
  brand: 'bg-theme-primary text-white hover:bg-theme-primary-600 transition-colors',
  brandSm: 'h-8 px-3 rounded-lg bg-theme-primary text-white text-[13px] font-medium hover:bg-theme-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
  ghost: 'text-theme-text-tertiary hover:text-theme-text-primary hover:bg-theme-hover transition-colors',
  outline: 'border border-theme-neutral-300 bg-theme-surface-raised hover:bg-theme-surface-alt transition-colors',
} as const
