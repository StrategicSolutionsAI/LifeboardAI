# LifeboardAI Front-End Style Guide

*A comprehensive design system and style guide for consistent UI development*

## Table of Contents
1. [Overview](#overview)
2. [Design Tokens](#design-tokens)
3. [Typography System](#typography-system)
4. [Color Palette](#color-palette)
5. [Spacing & Layout](#spacing--layout)
6. [Component Patterns](#component-patterns)
7. [Widget System](#widget-system)
8. [Animations & Micro-interactions](#animations--micro-interactions)
9. [Accessibility Guidelines](#accessibility-guidelines)
10. [Code Conventions](#code-conventions)
11. [Implementation Examples](#implementation-examples)

---

## Overview

This style guide establishes consistent design patterns, components, and development practices for the LifeboardAI dashboard. It ensures visual cohesion, accessibility, and maintainable code across all features.

### Core Principles
- **Consistency**: Unified visual language across all components
- **Accessibility**: WCAG 2.1 AA compliance with keyboard navigation
- **Performance**: Optimized animations and efficient rendering
- **Scalability**: Modular components that grow with the application

---

## Design Tokens

### Foundation Variables
```css
/* Core spacing scale */
--spacing-xs: 0.25rem;    /* 4px */
--spacing-sm: 0.5rem;     /* 8px */
--spacing-md: 0.75rem;    /* 12px */
--spacing-lg: 1rem;       /* 16px */
--spacing-xl: 1.5rem;     /* 24px */
--spacing-2xl: 2rem;      /* 32px */

/* Border radius scale */
--radius-sm: 0.25rem;     /* 4px */
--radius-md: 0.5rem;      /* 8px */
--radius-lg: 0.75rem;     /* 12px */
--radius-xl: 1rem;        /* 16px */

/* Shadow scale */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
```

---

## Typography System

### Font Hierarchy

```css
/* Primary font weights */
.font-light { font-weight: 300; }
.font-normal { font-weight: 400; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.font-black { font-weight: 900; }

/* Text sizes and line heights */
.text-xs {
  font-size: 0.75rem;      /* 12px */
  line-height: 1rem;       /* 16px */
}

.text-sm {
  font-size: 0.875rem;     /* 14px */
  line-height: 1.25rem;    /* 20px */
}

.text-base {
  font-size: 1rem;         /* 16px */
  line-height: 1.5rem;     /* 24px */
}

.text-lg {
  font-size: 1.125rem;     /* 18px */
  line-height: 1.75rem;    /* 28px */
}

.text-xl {
  font-size: 1.25rem;      /* 20px */
  line-height: 1.75rem;    /* 28px */
}

.text-2xl {
  font-size: 1.5rem;       /* 24px */
  line-height: 2rem;       /* 32px */
}

.text-3xl {
  font-size: 1.875rem;     /* 30px */
  line-height: 2.25rem;    /* 36px */
}
```

### Usage Guidelines

#### Widget Content Hierarchy
```tsx
// Primary metric (large numbers)
<span className="text-lg font-bold text-gray-900">1,200</span>

// Secondary text (goals, units)
<span className="text-sm text-gray-500">/ 1800 cal</span>

// Widget titles
<span className="text-sm font-medium text-gray-600 uppercase tracking-wide">
  Daily Nutrition
</span>

// Labels and descriptions
<span className="text-xs text-gray-500">Last updated 2 hours ago</span>
```

---

## Color Palette

### Primary Colors
```css
/* Brand colors */
--blue-500: #3b82f6;
--blue-600: #2563eb;
--indigo-500: #6366f1;
--indigo-600: #4f46e5;

/* Widget icon backgrounds */
--violet-500: #8b5cf6;
--green-500: #10b981;
--orange-500: #f97316;
--teal-500: #14b8a6;
```

### Semantic Colors
```css
/* Status indicators */
--success: #10b981;     /* Green */
--warning: #f59e0b;     /* Amber */
--danger: #ef4444;      /* Red */
--info: #3b82f6;        /* Blue */

/* Progress bar colors */
--progress-low: #ef4444;      /* Red - needs attention */
--progress-medium: #f59e0b;   /* Amber - on track */
--progress-high: #10b981;     /* Green - good progress */
--progress-complete: #3b82f6; /* Blue - goal reached */
--progress-over: #8b5cf6;     /* Purple - exceeded goal */
```

### Gray Scale
```css
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-300: #d1d5db;
--gray-400: #9ca3af;
--gray-500: #6b7280;
--gray-600: #4b5563;
--gray-700: #374151;
--gray-800: #1f2937;
--gray-900: #111827;
```

### Color Usage Rules

1. **Widget Icon Backgrounds**: Use gradient backgrounds with consistent colors per category
2. **Text Colors**: 
   - Primary text: `text-gray-900`
   - Secondary text: `text-gray-600`
   - Muted text: `text-gray-500`
3. **Interactive States**: Use semantic colors for hover/focus states
4. **Progress Indicators**: Follow the semantic progress color system

---

## Spacing & Layout

### Widget Dimensions
```css
/* Standard widget sizes */
.widget-compact { width: 11rem; }      /* 176px */
.widget-normal { width: 12rem; }       /* 192px */
.widget-large { width: 14rem; }        /* 224px */

/* Standard widget padding */
.widget-padding { padding: 1rem; }     /* 16px */
```

### Layout Grid
```css
/* Dashboard grid */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 1.5rem; /* 24px */
}

/* Widget internal spacing */
.widget-header { margin-bottom: 0.75rem; }  /* 12px */
.widget-content { margin-top: 0.5rem; }     /* 8px */
.widget-footer { margin-top: 0.5rem; }      /* 8px */
```

### Responsive Breakpoints
```css
/* Mobile first approach */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
```

---

## Component Patterns

### Button Styles
```tsx
// Primary button
<Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
  Primary Action
</Button>

// Secondary button
<Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
  Secondary Action
</Button>

// Ghost button (minimal)
<Button variant="ghost" className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
  Tertiary Action
</Button>
```

### Card Components
```tsx
// Standard card
<Card className="rounded-xl border border-gray-100 bg-white shadow-sm">
  <CardContent className="p-4">
    {/* Content */}
  </CardContent>
</Card>

// Interactive card
<Card className="rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer">
  <CardContent className="p-4">
    {/* Content */}
  </CardContent>
</Card>
```

### Form Elements
```tsx
// Input field
<Input className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" />

// Select dropdown
<Select>
  <SelectTrigger className="rounded-lg border-gray-300">
    <SelectValue placeholder="Choose option" />
  </SelectTrigger>
</Select>
```

---

## Widget System

### Widget Structure Standard
```tsx
interface WidgetProps {
  title: string;
  icon: LucideIcon;
  iconColor: 'blue' | 'green' | 'orange' | 'violet' | 'teal' | 'indigo';
  primaryValue: string | number;
  primaryUnit?: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  progress?: number; // 0-100
  statusBadge?: {
    text: string;
    variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  };
  onClick?: () => void;
  className?: string;
}
```

### Widget Layout Pattern
```tsx
function StandardWidget({ title, icon: Icon, iconColor, primaryValue, primaryUnit, progress }: WidgetProps) {
  return (
    <div className="w-48 rounded-xl border border-gray-100 bg-white p-4 shadow-sm relative cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-${iconColor}-500 shadow-sm`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <span className="text-sm font-medium text-gray-600 uppercase tracking-wide truncate">
          {title}
        </span>
      </div>
      
      {/* Content */}
      <div className="mt-2 mb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">
              {primaryValue}
            </span>
            {primaryUnit && (
              <span className="text-sm text-gray-500">
                {primaryUnit}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Progress Bar */}
      {progress !== undefined && (
        <div className="w-full bg-gray-100 rounded-full h-1 mt-2">
          <div 
            className="h-1 rounded-full transition-all duration-300 bg-blue-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
```

### Widget Variants

#### Compact Widget
```tsx
// For tight spaces, minimal content
<Widget size="compact" variant="minimal" />
```

#### Detailed Widget  
```tsx
// For expanded views with additional content
<Widget size="large" variant="detailed">
  <div className="mt-3 pt-3 border-t border-gray-100">
    {/* Additional content */}
  </div>
</Widget>
```

#### Embedded Widget
```tsx
// For use within other components (no card wrapper)
<Widget variant="embedded" className="p-0" />
```

---

## Animations & Micro-interactions

### Animation Constants
```css
/* Timing functions */
--ease-out: cubic-bezier(0.0, 0.0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0.0, 1, 1);
--ease-in-out: cubic-bezier(0.4, 0.0, 0.2, 1);

/* Duration scale */
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 300ms;
--duration-slower: 500ms;
```

### Standard Transitions
```css
/* Hover effects */
.hover-lift {
  transition: all 200ms ease-out;
}
.hover-lift:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}

/* Button interactions */
.button-press {
  transition: all 150ms ease-out;
}
.button-press:active {
  transform: scale(0.98);
}

/* Progress bar animations */
.progress-fill {
  transition: width 500ms ease-out;
}

/* Loading states */
.loading-skeleton {
  animation: pulse 2s cubic-bezier(0.4, 0.0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### Micro-interaction Patterns
```tsx
// Icon rotation on hover
<RefreshCw className="transition-transform duration-300 group-hover:rotate-180" />

// Scale on click
<Button className="transition-all duration-150 active:scale-95">
  Click me
</Button>

// Progress bar growth
<div 
  className="h-2 rounded-full bg-blue-500 transition-all duration-500"
  style={{ width: `${progress}%` }}
/>

// Shimmer loading effect
<div className="bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse rounded" />
```

---

## Accessibility Guidelines

### Keyboard Navigation
```tsx
// All interactive elements must be keyboard accessible
<button 
  className="focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Accessible Button
</button>
```

### ARIA Labels
```tsx
// Progress bars
<div 
  role="progressbar" 
  aria-valuenow={progress} 
  aria-valuemin={0} 
  aria-valuemax={100}
  aria-label="Daily goal progress"
/>

// Status indicators
<div aria-live="polite" aria-atomic="true">
  <span className="sr-only">Status updated: </span>
  Goal completed!
</div>

// Interactive widgets
<div 
  role="button"
  tabIndex={0}
  aria-label="Open nutrition details"
  aria-describedby="nutrition-summary"
/>
```

### Color Contrast Requirements
```css
/* Minimum contrast ratios (WCAG AA) */
/* Normal text: 4.5:1 */
/* Large text (18px+ or 14px+ bold): 3:1 */
/* UI components: 3:1 */

/* High contrast text combinations */
.text-primary { color: #111827; } /* Gray-900 on white: 16.05:1 */
.text-secondary { color: #374151; } /* Gray-700 on white: 9.25:1 */
.text-muted { color: #6b7280; } /* Gray-500 on white: 4.61:1 */
```

### Screen Reader Support
```tsx
// Hidden content for screen readers
<span className="sr-only">
  Progress: 75% complete
</span>

// Skip links
<a 
  href="#main-content" 
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded"
>
  Skip to main content
</a>
```

---

## Code Conventions

### Component Structure
```tsx
// 1. Imports (external libraries first, then internal)
import React, { useState, useEffect } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// 2. Type definitions
interface ComponentProps {
  required: string;
  optional?: boolean;
  className?: string;
}

// 3. Component definition
export function ComponentName({ 
  required, 
  optional = false, 
  className 
}: ComponentProps) {
  // 4. State and hooks
  const [state, setState] = useState<boolean>(false);
  
  // 5. Derived values and calculations
  const computedValue = useMemo(() => {
    return state ? 'active' : 'inactive';
  }, [state]);
  
  // 6. Event handlers
  const handleClick = useCallback(() => {
    setState(!state);
  }, [state]);
  
  // 7. Early returns
  if (!required) {
    return null;
  }
  
  // 8. Main render
  return (
    <div className={cn('base-styles', className)}>
      {/* Component content */}
    </div>
  );
}
```

### CSS Class Naming
```tsx
// Use Tailwind utilities with consistent patterns
<div className="w-48 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
  {/* Layout classes first, then styling, then state modifiers */}
  <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors">
    Click me
  </button>
</div>
```

### File Organization
```
src/
├── components/
│   ├── ui/               # Base UI components
│   ├── widgets/          # Widget-specific components
│   ├── forms/            # Form components
│   └── layout/           # Layout components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
├── types/                # TypeScript type definitions
└── styles/               # Global styles and themes
```

### TypeScript Best Practices
```tsx
// Use strict typing for props
interface StrictProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  variant: 'primary' | 'secondary';
}

// Use union types for controlled variants
type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

// Export types that might be reused
export interface WidgetData {
  id: string;
  name: string;
  value: number;
  target: number;
  color: string;
}
```

---

## Implementation Examples

### Complete Widget Implementation
```tsx
import React from 'react';
import { Apple } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NutritionWidgetProps {
  calories: number;
  goal: number;
  progress: number;
  className?: string;
  onClick?: () => void;
}

export function NutritionWidget({ 
  calories, 
  goal, 
  progress, 
  className, 
  onClick 
}: NutritionWidgetProps) {
  const getProgressColor = () => {
    if (progress < 25) return 'bg-red-400';
    if (progress < 75) return 'bg-yellow-400';
    if (progress <= 100) return 'bg-green-500';
    return 'bg-blue-500';
  };

  return (
    <div 
      className={cn(
        "w-48 rounded-xl border border-gray-100 bg-white p-4 shadow-sm",
        "cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all",
        className
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Nutrition progress: ${calories} of ${goal} calories`}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-500 shadow-sm">
          <Apple className="h-5 w-5 text-white" />
        </div>
        <span className="text-sm font-medium text-gray-600 uppercase tracking-wide truncate">
          Daily Nutrition
        </span>
      </div>
      
      {/* Content */}
      <div className="mt-2 mb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">
              {calories}
            </span>
            <span className="text-sm text-gray-500">
              / {goal} cal
            </span>
          </div>
          {progress < 25 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-500 text-white">
              Low
            </span>
          )}
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-gray-100 rounded-full h-1 mt-2">
        <div 
          className={cn(
            "h-1 rounded-full transition-all duration-300",
            getProgressColor()
          )}
          style={{ width: `${Math.min(progress, 100)}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
```

### Responsive Grid Layout
```tsx
export function DashboardGrid({ widgets }: { widgets: Widget[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
      {widgets.map((widget) => (
        <WidgetRenderer key={widget.id} widget={widget} />
      ))}
    </div>
  );
}
```

### Loading State Pattern
```tsx
export function WidgetSkeleton() {
  return (
    <div className="w-48 rounded-xl border border-gray-100 bg-white p-4 shadow-sm animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-9 h-9 rounded-lg bg-gray-200" />
        <div className="h-4 bg-gray-200 rounded flex-1" />
      </div>
      <div className="space-y-2">
        <div className="h-6 bg-gray-200 rounded w-3/4" />
        <div className="h-1 bg-gray-200 rounded w-full" />
      </div>
    </div>
  );
}
```

---

## Testing Guidelines

### Component Testing
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { NutritionWidget } from './NutritionWidget';

describe('NutritionWidget', () => {
  it('renders with correct aria labels', () => {
    render(
      <NutritionWidget 
        calories={1200} 
        goal={1800} 
        progress={67} 
      />
    );
    
    expect(screen.getByLabelText(/nutrition progress: 1200 of 1800 calories/i)).toBeInTheDocument();
  });

  it('shows low badge when progress is under 25%', () => {
    render(
      <NutritionWidget 
        calories={300} 
        goal={1800} 
        progress={17} 
      />
    );
    
    expect(screen.getByText('Low')).toBeInTheDocument();
  });
});
```

---

This style guide serves as the single source of truth for LifeboardAI's front-end development. All components should follow these patterns to ensure consistency, accessibility, and maintainability across the application.

**Version**: 1.0  
**Last Updated**: December 2024  
**Maintained By**: Front-End Development Team