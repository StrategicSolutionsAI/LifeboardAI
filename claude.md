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

## UI/UX Conventions
- **Confirm approach before coding**: For UI changes, describe the approach in 2-3 bullet points (which files, where new UI goes, what pattern to follow) and wait for user approval before writing code.
- **Consolidate into existing patterns**: Add new actions/controls into existing UI patterns (edit modals, popovers, context menus) rather than scattering buttons across multiple views.
- **Match existing patterns**: When adding new UI elements, find and follow the closest existing pattern in the codebase. Reference it explicitly.
- **No emoji overuse**: Don't add decorative emojis to UI unless the user requests it.

## Build & Verification
- After making changes, run `npx tsc --noEmit` to verify TypeScript compilation. Do not rationalize away type errors — fix them.
- Run `npm run build` for significant changes to catch prerender and bundling issues.
- If the dev server or build fails, investigate the root cause rather than switching ports or restarting repeatedly.
- **Visual verification required**: Always verify UI changes visually using the preview tool. If preview requires authentication and you can't log in, explicitly tell the user rather than silently skipping verification. Never consider a UI task done without visual confirmation.

## Dev Server
- Do NOT restart the dev server unless explicitly asked. If it's already running, use it.
- If you need to restart, kill the existing process on the correct port first (`lsof -ti:PORT | xargs kill`).
- The app typically runs on port 3000. Don't switch to random ports — investigate why the current port is occupied.
- Never start a second dev server instance alongside an existing one.

## Code Editing Rules
- **Verify file paths**: Before editing, confirm the file path is in the current project (`/Users/dalitbarrett/CascadeProjects/lifeboardaicodex/`). Never edit files outside this project unless explicitly asked.
- **Check references before removing**: When removing imports, functions, or variables, grep for other references in the file and across the project before deleting.
- **Don't over-explore**: Front-load implementation over exploration. Minimize time spent grepping and reading files that aren't directly relevant to the task.

## Performance Work
- Start by identifying the core bottleneck before making surface-level changes. Profile or measure first, then optimize.
- Establish baselines (module count, compile time, bundle size) before and after changes.
- Don't require the user to push back multiple times — find the real issue on the first pass.

## Session Scope
- For large tasks, focus on a single deliverable per session rather than attempting everything at once.
- If a task has multiple phases, implement first, polish second. Don't spend the whole session exploring.
- Note follow-up work in comments or conversation rather than trying to do it all now.
