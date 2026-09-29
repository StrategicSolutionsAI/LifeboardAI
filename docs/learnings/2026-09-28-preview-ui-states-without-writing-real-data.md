# Preview UI states on a live account without writing to its data

**Problem** — The dev browser is signed into the user's real account. The new Today view's timed sections, Now badge and Completed list had nothing to render (no tasks due today), and clicking "Move all to today" or quick add to create data would have rewritten the user's real tasks.

**Approach** — Split verification by risk: every write path (complete, move, undo, quick add, occurrence done) was pinned with React Testing Library tests against mocked `useTaskActions`, asserting the exact `createTask` / `batchUpdateTasks` / `setOccurrenceDone` arguments. For the visual pass, looked for a client-only way into the task cache and found the `lifeboard:task-injected` window event in `src/hooks/use-task-fetcher.ts` (built for chat-created tasks) — it prepends a task to the in-memory cache with no network call.

**Solution** — In the browser console: `window.dispatchEvent(new CustomEvent('lifeboard:task-injected', { detail: { task } }))` with `id: 'demo-…'` tasks due today (timed, untimed, repeating, one completed). Screenshot, then reload — the fakes are gone and nothing was persisted. Clicks on demo rows would hit the API with bogus ids, so only read-only interactions (expand, popover open, typing without submit) were exercised live.

**Rule** — On a real signed-in account, never create, move or complete records just to see a state. Test write paths with mocked actions and exact-argument assertions; render states by injecting into the client cache (`lifeboard:task-injected` for tasks), and reload to discard. Name injected ids `demo-*` so they're recognisable if anything leaks.

**Dead ends** — None tried; considered and rejected: monkey-patching `window.fetch` from the console (the task prefetch fires at module evaluation, so a later patch would need a forced refetch and still risks mutations going to the real API), and creating then deleting "test" tasks (still writes to real data and fires household-sharing side effects).
