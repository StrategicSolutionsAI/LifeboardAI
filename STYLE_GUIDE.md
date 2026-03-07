# LifeboardAI Style Guide

> Accurate documentation of the 3-layer design system as implemented.
> **Last Updated:** March 2026

---

## Architecture Overview

The design system flows through three layers:

```
CSS Variables (globals.css)
  → Tailwind Mappings (tailwind.config.ts)
    → Composed Tokens (src/lib/styles.ts)
```

1. **CSS Variables** define raw values and handle light/dark mode switching.
2. **Tailwind Config** maps those variables to utility classes (`text-theme-text-primary`, `bg-theme-surface-raised`, etc.).
3. **`styles.ts`** composes Tailwind classes into semantic tokens for common patterns (cards, forms, badges, etc.).

### How to use tokens

```tsx
import { card, text, surface, form, elevation, layout } from '@/lib/styles'
import { cn } from '@/lib/utils'

// Use composed tokens directly
<div className={cn(card.base, layout.padding.standard)}>
  <h2 className={cn(text.heading.lg, text.primary)}>Title</h2>
  <p className={cn(text.size.md, text.secondary)}>Description</p>
</div>

// Use surface.pageBgStyle for the warm page gradient
<div style={surface.pageBgStyle}>...</div>
```

---

## Color System

### Brand Primary (Warm Earth Tones)

The brand color is **#B1916A** (warm golden brown), not purple.

```css
--theme-primary-50:  #fdf8f6
--theme-primary-100: #f2e8e5
--theme-primary-200: #eaddd7
--theme-primary-300: #dbd6cf
--theme-primary-400: #bb9e7b
--theme-primary-500: #B1916A   /* ← Brand primary */
--theme-primary-600: #9a7b5a
--theme-primary-700: #7d6349
--theme-primary-800: #5f4b38
--theme-primary-900: #3f3127
--theme-primary-950: #231c16
```

Tailwind: `text-theme-primary`, `bg-theme-primary-600`, `border-theme-primary-400`, etc.

### Secondary Scale

```css
--theme-secondary-50:  #faf8f5
--theme-secondary-500: #a38a6a   /* ← Secondary base */
--theme-secondary-950: #2a221a
```

### Neutral Scale

Warm-shifted neutrals for surfaces, borders, and text.

```css
--theme-neutral-0:   #ffffff
--theme-neutral-50:  #fcfaf8
--theme-neutral-100: #f5f3f0
--theme-neutral-200: #eae6e1
--theme-neutral-300: #dbd6cf   /* ← Default border */
--theme-neutral-400: #b0a89e
--theme-neutral-500: #8e8880
--theme-neutral-600: #6b6560
--theme-neutral-700: #4a4540
--theme-neutral-800: #2e2a27
--theme-neutral-900: #1a1816
--theme-neutral-950: #0d0c0b
```

### Text Hierarchy

| Token | Variable | Light Value | Usage |
|-------|----------|-------------|-------|
| `text-theme-text-primary` | `--theme-text-primary` | `#314158` | Headings, important content |
| `text-theme-text-secondary` | `--theme-text-secondary` | `#596881` | Body text, descriptions |
| `text-theme-text-body` | `--theme-text-body` | `#4a5568` | Standard paragraph text |
| `text-theme-text-tertiary` | `--theme-text-tertiary` | `#8e99a8` | Helper text, timestamps, labels |
| `text-theme-text-subtle` | `--theme-text-subtle` | `#6b7688` | De-emphasized labels |
| `text-theme-text-quaternary` | `--theme-text-quaternary` | `#b0b8c4` | Placeholders, disabled text |
| `text-theme-text-inverse` | `--theme-text-inverse` | `#ffffff` | Text on dark backgrounds |

`styles.ts` exports: `text.primary`, `text.secondary`, `text.body`, `text.tertiary`, `text.subtle`, `text.quaternary`, `text.inverse`, `text.brand`, `text.accent`

### Semantic Status Colors

| Status | 500 value | Tint variable | Usage |
|--------|-----------|---------------|-------|
| Success | `#48B882` | `--theme-success-tint` (15% opacity) | Completed, positive |
| Warning | `#C4A44E` | `--theme-warning-tint` | Caution, pending |
| Error | `#d4183d` | `--theme-error-tint` | Errors, destructive |
| Info | `#4AADE0` | `--theme-info-tint` | Informational |

### Brand Tint Scale

Semi-transparent brand overlays for backgrounds and interactive states:

```css
--theme-brand-tint-subtle:  rgba(177, 145, 106, 0.04)
--theme-brand-tint-muted:   rgba(177, 145, 106, 0.06)
--theme-brand-tint-light:   rgba(177, 145, 106, 0.08)
--theme-brand-tint:          rgba(177, 145, 106, 0.12)
--theme-brand-tint-strong:  rgba(177, 145, 106, 0.15)
```

Tailwind: `bg-theme-brand-tint-subtle`, `bg-theme-brand-tint-muted`, `bg-theme-brand-tint-light`, `bg-theme-brand-tint`, `bg-theme-brand-tint-strong`

### Interactive State Colors

```css
--theme-hover-overlay:  rgba(177, 145, 106, 0.08)   /* bg-theme-hover */
--theme-active-overlay: rgba(177, 145, 106, 0.14)   /* bg-theme-active */
--theme-focus-ring:     var(--theme-primary-500)      /* ring color */
--theme-selection:      var(--theme-primary-100)      /* selected item bg */
```

---

## Typography

### Font Families

- **Headings:** DM Sans (`var(--font-dm-sans)`)
- **Body/UI:** Inter (`var(--font-inter)`)
- **Auth pages:** Manrope (intentional exception — unique to login/signup)

### `text.*` Tokens from `styles.ts`

**Heading presets** (size + weight, no color — compose with a color token):

| Token | Classes |
|-------|---------|
| `text.heading['2xl']` | `text-[28px] font-semibold leading-tight` |
| `text.heading.xl` | `text-2xl font-semibold leading-tight` |
| `text.heading.lg` | `text-xl font-semibold leading-tight` |
| `text.heading.md` | `text-lg font-semibold leading-snug` |
| `text.heading.sm` | `text-base font-semibold leading-snug` |
| `text.heading.xs` | `text-sm font-semibold leading-snug` |

**Body presets** (size + weight, no color):

| Token | Classes |
|-------|---------|
| `text.size.lg` | `text-base font-normal leading-relaxed` |
| `text.size.md` | `text-sm font-normal leading-normal` |
| `text.size.sm` | `text-xs font-normal leading-normal` |
| `text.size.xs` | `text-2xs font-normal leading-normal` (10px) |

**Composed presets** (ready to use):

| Token | Description |
|-------|-------------|
| `text.pageTitle` | 24px semibold, primary color |
| `text.label` | 11px uppercase, subtle color |
| `text.sectionLabel` | 12px uppercase, secondary color |
| `text.metric` | 3xl black, primary color |
| `text.statValue` | 28px, primary color |
| `text.caption` | 10px medium, tertiary color |
| `text.tableHeader` | 11px uppercase, tertiary color |
| `text.link` | Primary-600, hover primary-700, underline |

### Custom Font Sizes

```
text-3xs  → 9px  / 12px line-height
text-2xs  → 10px / 14px line-height
text-xs   → 12px (Tailwind default)
text-sm   → 14px (Tailwind default)
```

`text-[11px]` is kept as an arbitrary value — it's an intentional midpoint between xs (12px) and 2xs (10px), used for labels, badges, and nav.

---

## Surfaces & Elevation

### Surface Tokens

| Token | Variable | Light | Dark | Usage |
|-------|----------|-------|------|-------|
| `surface.base` | `--theme-surface-base` | `#ffffff` | `#0a0a0a` | Page background |
| `surface.raised` | `--theme-surface-raised` | `#ffffff` | `#171717` | Cards, panels |
| `surface.overlay` | `--theme-surface-overlay` | `#ffffff` | `#262626` | Popovers, dropdowns |
| `surface.sunken` | `--theme-surface-sunken` | `#fcfaf8` | `#050505` | Inset areas |
| `surface.alt` | `--theme-surface-alt` | `#faf8f5` | `#1a1a1a` | Alternate sections |
| `surface.selected` | `--theme-surface-selected` | `#f5ede4` | `#2d2d2d` | Selected items |

### Warm-Tint Surface Scale

Translucent warm overlays for paper-like backgrounds:

```
warm-30 → warm-50 → warm-60 → warm-70 → warm-80 → warm-90 → warm (opaque)
```

Usage: `surface.warm70` or `bg-theme-surface-warm-70`

### Page Background Gradient

Use `surface.pageBgStyle` (a `React.CSSProperties` object) for the warm gradient applied to layout shells:

```tsx
<div style={surface.pageBgStyle}>...</div>
```

### Elevation Hierarchy

Shadow + border combos, lightest to heaviest:

| Token | Shadow | Usage |
|-------|--------|-------|
| `elevation.none` | `shadow-none` | Flat elements |
| `elevation.micro` | `shadow-micro` | Minimal lift |
| `elevation.xs` | `shadow-xs` | Subtle cards |
| `elevation.sm` | `shadow-warm-sm` | Standard cards |
| `elevation.md` | `shadow-warm` | Hover states |
| `elevation.lg` | `shadow-warm-lg` | Prominent panels |
| `elevation.popover` | `shadow-[0px_8px_24px_rgba(163,133,96,0.12)]` | Popovers, dropdowns |

All elevation tokens include a `border border-theme-neutral-300` (with varying opacity).

**Shadow color note:** Shadows use `rgba(163,133,96,…)` — intentionally darker/desaturated compared to the brand `rgba(177,145,106,…)` — for muted, natural shadows.

---

## Component Tokens

### Cards (`card.*`)

| Token | Description |
|-------|-------------|
| `card.base` | Standard card (rounded-xl, raised bg, shadow, border) |
| `card.interactive` | Hoverable card with cursor-pointer |
| `card.section` | Card with responsive padding (p-4 sm:p-6) |
| `card.panel` | Modal/sheet container (rounded-2xl) |
| `card.popover` | Popover with backdrop blur |
| `card.task` | Task card with group hover |
| `card.stat` | Stat card |
| `card.inset` | Inset container (rounded-lg, alt bg) |

### Forms (`form.*`)

| Token | Description |
|-------|-------------|
| `form.input` | Standard text input (rounded-lg, border, shadow, focus ring) |
| `form.textarea` | Textarea with resize-y |
| `form.label` | 11px uppercase label |
| `form.select` | Select dropdown |
| `form.authInput` | Auth page input (lighter, no shadow, translucent bg) |

### Badges (`badge.*`)

| Token | Description |
|-------|-------------|
| `badge.base` | Base badge (rounded-md, 11px) |
| `badge.pill` | Pill badge (rounded-full, border) |
| `badge.success` | Green badge |
| `badge.warning` | Amber badge |
| `badge.danger` | Red badge |
| `badge.info` | Brand-tinted badge |
| `badge.neutral` | Neutral badge |
| `badge.count` | Tiny count circle (9px, rounded-full) |

### Buttons (`button.*`)

| Token | Description |
|-------|-------------|
| `button.brand` | Brand primary button |
| `button.brandSm` | Small brand button (h-8) |
| `button.ghost` | Ghost button (tertiary text, hover bg) |
| `button.outline` | Outline button with border |

### Navigation (`nav.*`)

| Token | Description |
|-------|-------------|
| `nav.sidebarIndicator` | Left pill indicator (3px, primary color) |
| `nav.bottomIndicator` | Top pill indicator for mobile nav |
| `nav.tabIndicator` | Bottom line for tab bars |

### Icon Boxes (`iconBox.*`)

| Token | Dimensions |
|-------|-----------|
| `iconBox.sm` | 28x28px, rounded-lg |
| `iconBox.md` | 36x36px, rounded-lg |
| `iconBox.lg` | 40x40px, rounded-lg |

### Progress (`progress.*`)

| Token | Description |
|-------|-------------|
| `progress.track` | Full-width track (h-2) |
| `progress.trackSm` | Slim track (h-1) |
| `progress.fill.low` | Red fill |
| `progress.fill.medium` | Amber fill |
| `progress.fill.high` | Green fill |
| `progress.fill.complete` | Brand fill |
| `progress.fill.brand` | Brand fill (faster transition) |
| `progress.fill.over` | Purple fill (over 100%) |

---

## Interactive States (`interactive.*`)

| Token | Classes |
|-------|---------|
| `interactive.transition` | `transition-all duration-200 ease-out` |
| `interactive.transitionFast` | `transition-all duration-150 ease-out` |
| `interactive.transitionSlow` | `transition-all duration-300 ease-out` |
| `interactive.hover` | Hover overlay bg |
| `interactive.hoverBrand` | Brand tint hover |
| `interactive.hoverSubtle` | Alt surface hover |
| `interactive.hoverWarm` | Warm surface hover |
| `interactive.focus` | Focus ring (2px, 40% opacity) |
| `interactive.focusTight` | Tight focus ring (1px) |
| `interactive.active` | Scale down on press |
| `interactive.clickable` | Full click interaction (hover + active) |
| `interactive.disabled` | `disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none` |
| `interactive.disabledSubtle` | `disabled:opacity-40 disabled:cursor-not-allowed` |

---

## Spacing (`layout.*`)

| Scale | Padding | Gap |
|-------|---------|-----|
| compact | `p-3` | `gap-3` |
| standard | `p-4` | `gap-4` |
| spacious | `p-5` | `gap-5` |
| section | `p-4 sm:p-6` | `gap-6` |

Also: `layout.px.compact`, `layout.px.standard`, `layout.px.spacious`, `layout.px.section`

---

## Border Tokens (`border.*`)

| Token | Description |
|-------|-------------|
| `border.default` | `border-theme-neutral-300` |
| `border.subtle` | 50% opacity neutral border |
| `border.strong` | 80% opacity neutral border |
| `border.brand` | Primary-400 border |
| `border.focus` | Secondary border for focus |
| `border.divider` | Horizontal divider (`border-t`) |
| `border.subtle60` | Warm-tinted 60% border |
| `border.subtle70` | Warm-tinted 70% border |
| `border.subtle90` | Warm-tinted 90% border |

---

## Design Decisions

### Border Radius Hierarchy

| Element | Radius | Token |
|---------|--------|-------|
| Card / container | `rounded-xl` | `card.base` |
| Modal / sheet | `rounded-2xl` | `card.panel` |
| Button / input | `rounded-lg` | `form.input`, `button.*` |
| Badge | `rounded-md` or `rounded-full` | `badge.base`, `badge.pill` |
| Icon box | `rounded-lg` | `iconBox.*` |
| Pill / chip | `rounded-full` | `badge.count` |

Base radius: `--radius: 0.625rem` (10px). `rounded-lg` resolves to this base.

### Shadow Colors

Shadows use `rgba(163,133,96,…)` — darker and more muted than the brand primary `rgba(177,145,106,…)`. This is intentional: brand-tinted shadows at full brightness would color-shift card surfaces. The desaturated tone creates natural depth.

### Warm-Tint Scale

The warm-tint surfaces (`warm-30` through `warm-90`) use `rgba(252,250,248,…)` in light mode and `rgba(30,28,26,…)` in dark mode. They create a subtle paper-like warmth.

Common assignments:
- Page backgrounds: `warm-70`
- Hover states: `warm-50`
- Weekend calendar cells: `warm-60`
- Inactive tabs: `warm-90`
- Off-month calendar cells: `warm-30`

---

## Intentional Exceptions

These hardcoded values are **not** bugs — they serve specific purposes:

1. **Widget accent colors** (~30 hex values) — Each widget type has a unique accent from a curated palette. Not tokenized because they're per-widget, not theme-wide.

2. **Landing page** — Custom marketing colors, gradients, and animations that don't follow the app design system.

3. **Auth pages (`font-['Manrope',sans-serif]`)** — Login/signup use Manrope font intentionally, distinct from the app's DM Sans/Inter.

4. **`text-[#171A1F]` in settings** — Extra-dark color for color swatch labels where maximum contrast is needed. Darker than `--theme-text-primary`.

5. **`text-[11px]` arbitrary values** — Intentional midpoint between `text-xs` (12px) and `text-2xs` (10px). Used for sidebar nav labels, badges, and form labels.

6. **Error/404 pages** — Standalone pages with custom illustration colors.

7. **Icon generation colors** — Hardcoded palette for dynamically generated category icons.

---

## Migration Checklist

When converting a component to use design tokens:

- [ ] Replace `text-[#8e99a8]` → `text-theme-text-tertiary`
- [ ] Replace `text-[#4a5568]` → `text-theme-text-body`
- [ ] Replace `text-[#314158]` → `text-theme-text-primary`
- [ ] Replace `text-[#596881]` → `text-theme-text-secondary`
- [ ] Replace `text-[#9a7b5a]` → `text-theme-primary-600`
- [ ] Replace `bg-[rgba(177,145,106,0.08)]` → `bg-theme-brand-tint-light`
- [ ] Replace `bg-[rgba(177,145,106,0.12)]` → `bg-theme-brand-tint`
- [ ] Replace `bg-[rgba(183,148,106,0.14)]` → `bg-theme-active`
- [ ] Replace `border-[#dee4ee]` → `border-theme-neutral-300`
- [x] Replace `text-[10px]` → `text-2xs` (when line-height matches)
- [x] Replace `text-[9px]` → `text-3xs` (when line-height matches)
- [ ] Replace inline gradient `backgroundImage: "linear-gradient(90deg, rgba(252,250,248,0.7)..."` → `style={surface.pageBgStyle}`
- [ ] Replace `shadow-[0px_8px_24px_rgba(163,133,96,0.12)]` → use `elevation.popover`
- [ ] Import from `@/lib/styles` instead of writing raw Tailwind classes for repeated patterns

---

## File References

| File | Role |
|------|------|
| `src/app/globals.css` | CSS variables (light + dark) |
| `tailwind.config.ts` | Tailwind mappings + custom utilities |
| `src/lib/styles.ts` | Composed style tokens |
| `src/lib/utils.ts` | `cn()` class merging utility |
