# LifeboardAI Style Guide

> A comprehensive design system based on the calendar component and global styling patterns.

---

## Table of Contents

1. [Color System](#color-system)
2. [Typography](#typography)
3. [Spacing & Layout](#spacing--layout)
4. [Components](#components)
5. [Interactions & States](#interactions--states)
6. [Animations](#animations)
7. [Accessibility](#accessibility)

---

## Color System

### Primary Brand Palette

Our core brand color is **LifeboardAI Purple** (`#8491FF`), with a complete 50-950 scale for versatility.

```css
--theme-primary-50: #f4f6ff    /* Ultra light tint */
--theme-primary-100: #ebeeff   /* Light tint */
--theme-primary-200: #d9deff   /* Lighter */
--theme-primary-300: #c2ccff   /* Light */
--theme-primary-400: #a4b4ff   /* Medium light */
--theme-primary-500: #8491ff   /* Base brand purple */
--theme-primary-600: #6b7bdd   /* Medium dark */
--theme-primary-700: #5866bb   /* Dark */
--theme-primary-800: #475199   /* Darker */
--theme-primary-900: #3c4477   /* Darkest */
--theme-primary-950: #252a55   /* Ultra dark */
```

**Usage:**
- Primary actions, CTAs, active states
- Focus indicators and selection highlights
- Brand moments throughout the interface

### Neutral System

A sophisticated 0-950 neutral scale for text hierarchy, surfaces, and borders.

```css
--theme-neutral-0: #ffffff     /* Pure white */
--theme-neutral-50: #fafafa    /* Off white */
--theme-neutral-100: #f5f5f5   /* Light gray */
--theme-neutral-200: #e5e5e5   /* Light border */
--theme-neutral-300: #d4d4d4   /* Medium border */
--theme-neutral-400: #a3a3a3   /* Placeholder text */
--theme-neutral-500: #737373   /* Body text secondary */
--theme-neutral-600: #525252   /* Body text primary */
--theme-neutral-700: #404040   /* Headings */
--theme-neutral-800: #262626   /* Dark headings */
--theme-neutral-900: #171717   /* Ultra dark */
--theme-neutral-950: #0a0a0a   /* Pure black */
```

**Usage:**
- Text hierarchy (quaternary → primary)
- Backgrounds and surfaces
- Borders and dividers

### Semantic Colors

Purpose-driven colors for system feedback and status indicators.

#### Success (Green)
```css
--theme-success-500: #10b981
```
Use for: completed tasks, success messages, positive confirmations

#### Warning (Amber)
```css
--theme-warning-500: #f59e0b
```
Use for: cautionary messages, pending states, attention needed

#### Error (Red)
```css
--theme-error-500: #ef4444
```
Use for: errors, destructive actions, critical alerts

#### Info (Blue)
```css
--theme-info-500: #3b82f6
```
Use for: informational messages, tips, neutral notifications

### Bucket Color System

Calendar events use a sophisticated color-coding system based on bucket assignments:

| Color | Hex | Usage |
|-------|-----|-------|
| Indigo | `#4F46E5` | Primary bucket category |
| Green | `#22C55E` | Growth/progress bucket |
| Orange | `#F97316` | Creative/energy bucket |
| Pink | `#EC4899` | Personal/self-care bucket |
| Teal | `#14B8A6` | Focus/productivity bucket |
| Violet | `#8B5CF6` | Learning/development bucket |
| Emerald | `#10B981` | Unassigned/default |

**Event Styling Pattern:**
```tsx
// Container with 50 tint bg, 400 left border, 900 text, 100 hover
bg-{color}-50 border-l-4 border-{color}-400 text-{color}-900 hover:bg-{color}-100

// Time text: 600 weight
text-{color}-600

// Dot indicator: 400 weight
bg-{color}-400
```

### Sticker Palette

Special accent colors for calendar stickers with soft, approachable tones:

| Sticker | Background | Text | Ring | Icon |
|---------|-----------|------|------|------|
| Celebrate | `bg-pink-50` | `text-pink-500` | `ring-pink-200/70` | Sparkles |
| Self-care | `bg-rose-50` | `text-rose-500` | `ring-rose-200/70` | Heart |
| Coffee | `bg-amber-50` | `text-amber-600` | `ring-amber-200/70` | Coffee |
| Sunshine | `bg-yellow-50` | `text-yellow-500` | `ring-yellow-200/70` | Sun |
| Focus | `bg-indigo-50` | `text-indigo-500` | `ring-indigo-200/70` | BookOpen |
| Movement | `bg-emerald-50` | `text-emerald-600` | `ring-emerald-200/70` | Dumbbell |

---

## Typography

### Font Family

**Primary:** Circular (Custom font family)
**Fallback:** "Circular Std", Circular, Helvetica Neue, Arial, sans-serif

```css
font-family: sans; /* Configured in Tailwind */
```

### Type Scale & Hierarchy

#### Heading 1
```css
.text-heading-1
font-size: 2.25rem (36px)
font-weight: 700 (bold)
line-height: 1.2
letter-spacing: -0.025em
color: var(--theme-text-primary)
```

#### Heading 2
```css
.text-heading-2
font-size: 1.875rem (30px)
font-weight: 600 (semibold)
line-height: 1.3
letter-spacing: -0.025em
color: var(--theme-text-primary)
```

#### Heading 3
```css
.text-heading-3
font-size: 1.5rem (24px)
font-weight: 600 (semibold)
line-height: 1.4
color: var(--theme-text-primary)
```

#### Body Large
```css
.text-body-large
font-size: 1.125rem (18px)
line-height: 1.6
color: var(--theme-text-secondary)
```

#### Body (Default)
```css
.text-body
font-size: 0.875rem (14px)
line-height: 1.5
color: var(--theme-text-secondary)
```

#### Caption
```css
.text-caption
font-size: 0.75rem (12px)
line-height: 1.4
font-weight: 500
color: var(--theme-text-tertiary)
```

#### Custom Utility Classes
```css
.lb-heading-sm
font-size: 1.125rem (18px)
line-height: 1.2
font-weight: 600
letter-spacing: -0.01em

.lb-body-xs
font-size: 0.8125rem (13px)
line-height: 1.35
font-weight: 500
```

### Text Hierarchy (Color)

```css
--theme-text-primary: neutral-800     /* Main headings, important text */
--theme-text-secondary: neutral-600   /* Body text, descriptions */
--theme-text-tertiary: neutral-500    /* Helper text, labels */
--theme-text-quaternary: neutral-400  /* Placeholders, disabled */
--theme-text-inverse: neutral-0       /* Text on dark backgrounds */
```

---

## Spacing & Layout

### Border Radius

Consistent rounding creates a modern, friendly aesthetic:

```css
--radius: 0.75rem (12px)         /* Base radius */
border-radius: var(--radius)     /* lg: 12px */
border-radius: calc(var(--radius) - 2px)  /* md: 10px */
border-radius: calc(var(--radius) - 4px)  /* sm: 8px */
```

**Common values:**
- `rounded-lg` (12px) - Cards, widgets, modals
- `rounded-xl` (16px) - Large containers, calendar grid
- `rounded-2xl` (24px) - Hero sections, prominent elements
- `rounded-full` - Badges, avatars, pills

### Container Standards

```css
.container
max-width: 1400px (2xl breakpoint)
padding: 2rem (32px)
margin: 0 auto (centered)
```

### Common Spacing Patterns

| Purpose | Spacing |
|---------|---------|
| Card padding | `p-3` to `p-6` (12-24px) |
| Section gaps | `gap-4` to `gap-8` (16-32px) |
| Element margins | `mb-2` to `mb-4` (8-16px) |
| Icon gaps | `gap-1.5` to `gap-2` (6-8px) |
| Grid gaps | `gap-x-1.5`, `gap-y-2` |

---

## Components

### Buttons

#### Primary Button
```tsx
<button className="btn-primary">
  {/* Background: primary-500, text: white, padding: 10px 20px */}
  {/* Hover: primary-600, lift effect */}
  {/* Focus: ring with primary-200 */}
</button>
```

**Classes:**
```css
.btn-primary
background: var(--theme-primary-500)
color: white
padding: 0.625rem 1.25rem
border-radius: 0.5rem
font-weight: 500
transition: all 0.2s ease-in-out
box-shadow: 0 1px 3px rgba(0,0,0,0.1)
```

#### Secondary Button
```tsx
<button className="btn-secondary">
  {/* Transparent bg, primary border, primary text */}
  {/* Hover: fills with primary-500, text white */}
</button>
```

#### Ghost Button
```tsx
<button className="btn-ghost">
  {/* Transparent, subtle hover overlay */}
  {/* Perfect for tertiary actions */}
</button>
```

### Cards

#### Standard Card
```tsx
<div className="widget-container">
  {/* White bg, subtle border, small shadow */}
  {/* Hover: lifts with enhanced shadow */}
</div>
```

**Specifications:**
```css
.widget-container
background: var(--theme-widget-bg)
border: 1px solid var(--theme-widget-border)
border-radius: 0.75rem
box-shadow: 0 1px 3px rgba(0,0,0,0.1)
transition: all 0.2s ease-in-out

:hover
box-shadow: 0 4px 6px rgba(0,0,0,0.1)
transform: translateY(-1px)
```

#### Card Header
```tsx
<div className="widget-header">
  {/* Light gray bg, bottom border */}
</div>
```

### Inputs

```tsx
<input className="input-field" />
```

**Specifications:**
```css
.input-field
background: var(--theme-surface-sunken)
border: 1px solid var(--theme-neutral-300)
border-radius: 0.5rem
padding: 0.75rem 1rem
font-size: 0.875rem

:focus
border-color: var(--theme-focus-ring)
box-shadow: 0 0 0 3px var(--theme-primary-100)
outline: none
```

### Status Indicators

#### Success Badge
```tsx
<div className="status-success">
  {/* Green-100 bg, green-700 text, green border */}
</div>
```

#### Warning Badge
```tsx
<div className="status-warning">
  {/* Amber-100 bg, amber-700 text, amber border */}
</div>
```

#### Error Badge
```tsx
<div className="status-error">
  {/* Red-100 bg, red-700 text, red border */}
</div>
```

**Common pattern:**
```css
display: inline-flex
align-items: center
padding: 0.25rem 0.75rem
border-radius: 9999px
font-size: 0.75rem
font-weight: 500
text-transform: uppercase
letter-spacing: 0.05em
```

### Bucket Tabs

```tsx
<div className="bucket-tab active">
  {/* Inactive: gray-100 bg, text-secondary */}
  {/* Active: primary-500 bg, text-inverse, bottom accent */}
</div>
```

**Specifications:**
```css
.bucket-tab
background: var(--theme-tab-inactive)
color: var(--theme-text-secondary)
border: 1px solid var(--theme-neutral-200)
transition: all 0.2s ease-in-out

.bucket-tab:hover
background: var(--theme-tab-hover)
color: var(--theme-text-primary)

.bucket-tab.active
background: var(--theme-tab-active)
color: var(--theme-text-inverse)
border-color: var(--theme-primary-600)
```

### Calendar Grid

#### Day Cell Pattern
```tsx
<div className="relative min-h-[100px] border border-gray-200 bg-white p-2">
  {/* Calendar day cell structure */}
</div>
```

#### Event Block
```tsx
<div className="bg-indigo-50 border-l-4 border-indigo-400 text-indigo-900 hover:bg-indigo-100 rounded px-2 py-1 text-xs">
  {/* Event with bucket color coding */}
</div>
```

---

## Interactions & States

### Hover Effects

#### Lift Effect
```css
.hover-lift
transition: transform 0.2s, box-shadow 0.2s

:hover
transform: translateY(-2px)
box-shadow: 0 10px 25px rgba(0,0,0,0.1)
```

#### Scale Effect
```css
.hover-scale
transition: transform 0.2s

:hover
transform: scale(1.02)
```

#### Background Overlay
```css
.premium-hover
transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)

:hover
transform: translateY(-6px) scale(1.02)
box-shadow: 0 25px 50px rgba(132, 145, 255, 0.15)
```

### Focus States

All interactive elements should have visible focus indicators:

```css
focus:outline-none
focus:ring-2
focus:ring-blue-500/20
focus:ring-offset-2
```

**Primary focus ring:**
```css
box-shadow: 0 0 0 3px var(--theme-primary-200)
```

### Active States

```css
active:bg-gray-200
active:scale-95
```

### Disabled States

```css
disabled:opacity-50
disabled:cursor-not-allowed
disabled:pointer-events-none
```

### Loading States

```tsx
<div className="skeleton">
  {/* Shimmer animation with gradient */}
</div>
```

```css
@keyframes skeletonShimmer {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}

.skeleton
background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)
background-size: 200px 100%
animation: skeletonShimmer 1.5s infinite
```

---

## Animations

### Duration & Easing

**Standard transitions:**
```css
transition: all 0.2s ease-in-out  /* Quick UI responses */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)  /* Smooth motion */
transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)  /* Premium feel */
```

### Entrance Animations

#### Fade In Up
```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.landing-fade-in
animation: fadeInUp 0.8s ease-out forwards
```

#### Hero Grand Entrance
```css
@keyframes heroGrandEntrance {
  0% {
    opacity: 0;
    transform: translateY(80px) scale(0.9);
    filter: blur(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0px);
  }
}

.hero-grand-entrance
animation: heroGrandEntrance 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)
```

### Continuous Animations

#### Float
```css
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.landing-float
animation: float 6s ease-in-out infinite
```

#### Parallax Float
```css
@keyframes parallaxFloat {
  0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
  33% { transform: translateY(-20px) translateX(10px) rotate(2deg); }
  66% { transform: translateY(-10px) translateX(-5px) rotate(-1deg); }
}

.parallax-float
animation: parallaxFloat 12s ease-in-out infinite
```

### Stagger Delays

For sequential reveals:

```css
.stagger-1 { animation-delay: 0.1s; }
.stagger-2 { animation-delay: 0.2s; }
.stagger-3 { animation-delay: 0.3s; }
.stagger-4 { animation-delay: 0.4s; }
.stagger-5 { animation-delay: 0.5s; }
```

### Glassmorphism Effects

```css
.ultra-glass
backdrop-filter: blur(20px) saturate(180%)
background: rgba(255, 255, 255, 0.1)
border: 1px solid rgba(255, 255, 255, 0.3)
box-shadow: 0 8px 32px rgba(132, 145, 255, 0.1)
```

---

## Accessibility

### Reduced Motion

Respect user preferences for reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  .hero-grand-entrance,
  .parallax-float,
  .card-levitation,
  /* All decorative animations */
  {
    animation: none !important;
  }

  .premium-hover,
  .feature-card-interactive
  /* Complex transitions */
  {
    transition: none !important;
  }
}
```

### Focus Indicators

All interactive elements must have visible focus states:
```css
focus:outline-none
focus:ring-2
focus:ring-{color}-500/20
```

### Color Contrast

Ensure WCAG AA compliance:
- Text on backgrounds: minimum 4.5:1 ratio
- Large text (18px+): minimum 3:1 ratio
- Interactive elements: minimum 3:1 ratio

### Semantic HTML

Use appropriate HTML elements:
- `<button>` for clickable actions
- `<a>` for navigation
- `<input>` with proper `type` attributes
- ARIA labels where necessary

---

## Design Principles

### 1. Consistency
- Use predefined color variables, not raw hex codes
- Stick to the type scale for all text sizing
- Apply consistent spacing patterns

### 2. Hierarchy
- Clear visual hierarchy through size, weight, and color
- Primary → Secondary → Tertiary actions clearly distinguished
- Content organized with proper heading levels

### 3. Feedback
- All interactions provide immediate visual feedback
- Loading states for async operations
- Clear error and success messaging

### 4. Performance
- Use hardware acceleration for animations (`transform`, `opacity`)
- Apply `will-change` sparingly
- Optimize for 60fps interactions

### 5. Accessibility First
- Keyboard navigable
- Screen reader friendly
- Respects user preferences (reduced motion, high contrast)

---

## Usage Examples

### Creating a Calendar Event Card

```tsx
<div className={`
  bg-indigo-50
  border-l-4
  border-indigo-400
  text-indigo-900
  hover:bg-indigo-100
  rounded-lg
  px-3
  py-2
  text-sm
  transition-colors
  duration-200
  cursor-pointer
`}>
  <div className="flex items-center gap-2">
    <div className="w-2 h-2 rounded-full bg-indigo-400" />
    <span className="font-medium">Team Meeting</span>
  </div>
  <p className="text-indigo-600 text-xs mt-1">2:00 PM - 3:00 PM</p>
</div>
```

### Creating a Status Badge

```tsx
<div className="status-success inline-flex items-center gap-1.5">
  <CheckCircle className="w-3 h-3" />
  <span>Completed</span>
</div>
```

### Creating a Primary CTA Button

```tsx
<button className="btn-primary flex items-center gap-2 hover-lift">
  <span>Get Started</span>
  <ArrowRight className="w-4 h-4" />
</button>
```

---

## File References

- **Tailwind Config:** `/tailwind.config.ts`
- **Global Styles:** `/src/app/globals.css`
- **Calendar Component:** `/src/components/full-calendar.tsx`
- **UI Components:** `/src/components/ui/`

---

**Last Updated:** October 2025
**Version:** 1.0.0
