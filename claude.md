# LifeboardAI Documentation for Claude

## Project Overview
LifeboardAI is a Next.js application with Supabase backend for managing tasks, calendars, and widgets in customizable buckets (tabs). It provides a personalized dashboard experience with performance-optimized components.

## Tech Stack
- Next.js 14.x (App Router)
- TypeScript
- Shadcn UI
- Tailwind CSS
- Supabase (Auth & Database)
- React Server Components / Client Components
- Framer Motion

## Key Project Patterns
- Server Components used by default
- `use client` directives only where necessary
- Performance optimization with TTL-based caching strategies
- Component organization under /src/components
- Pages under /src/app
- Functional and declarative programming patterns

## Important Features
- User onboarding flow (5 steps)
- Dashboard with customizable buckets (tabs)
- Widgets that can be added to buckets
- Calendar integrations
- Sidebar navigation (Dashboard, Calendar, Tasks, History, Profile, Settings)
- Optimized components for better performance
- Task management with caching and optimistic updates

## Code Style Preferences
- Functional components (no classes)
- Descriptive variable names with auxiliary verbs (e.g., isLoading, hasError)
- Preference for server components when possible
- TypeScript interfaces for type definitions
- Files structured with: exported component, subcomponents, helpers, static content, types
- Named exports for components
- Components in lowercase with dashes (e.g., new-component.tsx)

## Performance Optimizations
- Global Data Cache Hook with TTL-based caching
- Loading skeletons for improved perceived loading speed
- Optimized components (bucket tabs, taskboard, task panel)
- RAF throttling and intersection observer
- Virtual scrolling for large task lists
- Debounced saving for widgets

## Project Structure
Key directories:
- `/src/app` - Next.js pages and routing
- `/src/components` - Reusable components
- `/src/hooks` - Custom React hooks
- `/src/lib` - Utility functions
- `/src/types` - TypeScript type definitions

## Environment Considerations
- Code takes into account different environments: dev, test, and prod
