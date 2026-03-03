# Performance Audit Workflow

Follow this process strictly for any performance optimization task.

## Step 1: Establish Baselines (BEFORE any changes)
- Run `npm run build` and capture: module count, compile time, bundle sizes
- Note the specific page/feature that's slow
- Save these numbers — you'll compare against them after every change

## Step 2: Profile & Identify the Core Bottleneck
- Don't guess — investigate. Check for:
  - Heavy imports that could be tree-shaken (e.g., full icon libraries)
  - Large dependencies that could be lazy-loaded (e.g., Sentry, DnD, chart libs)
  - Circular dependencies
  - O(n²) or O(n*m) loops that could be O(n) with maps/sets
  - Redundant useEffect calls or unnecessary re-renders
  - Missing memoization on expensive computations
  - Parallel data fetching opportunities (Promise.all instead of sequential awaits)
- Identify the SINGLE biggest bottleneck before proposing any fix

## Step 3: Propose Fix (BEFORE implementing)
Present to the user:
1. **The bottleneck**: What you found and why it's the biggest issue
2. **The fix**: What you'll change and why
3. **Expected impact**: What metric you expect to improve

Wait for user approval before proceeding.

## Step 4: Implement & Measure
- Implement the single highest-impact fix
- Re-run `npm run build` and capture the same metrics from Step 1
- Report: before vs after (module count, compile time, bundle size)
- If improvement is measurable, move to the next bottleneck
- If no improvement or regression, revert and try a different approach

## Step 5: Repeat
- Go back to Step 2 for the next bottleneck
- Stop after 3 rounds or when gains are <5%
- Final output: markdown table showing each optimization, before/after metrics, and cumulative improvement

## Key Past Wins (reference these patterns first)
- Tree-shaking icon imports (lucide-react barrel imports → named imports)
- Lazy-loading heavy libs (Sentry, DnD kit, chart libraries)
- Breaking circular dependencies
- O(n*m) → O(n) with lookup maps for task/calendar mapping
- Parallel data fetching with Promise.all
- Auth token caching to avoid redundant Supabase calls
- Chunk preloading for critical routes
