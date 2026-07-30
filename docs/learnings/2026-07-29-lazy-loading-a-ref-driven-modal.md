# Deferring a modal that callers open through a ref

**Problem** — TaskEditorModal (22 kB parsed) was imported at module scope by /tasks, /calendar
and the dashboard even though it renders `null` until opened, so all three paid for it in First
Load JS. Wrapping it in `next/dynamic` looked like a one-line fix.

**Approach** — The one-line fix is wrong here, and the reason generalizes. This modal has no
`isOpen` prop; callers hold `taskEditorRef` and call `taskEditorRef.current.openWithTask(...)`
from a dozen handlers. Two things break at once:

1. `next/dynamic` returns a plain function component and does **not** forward refs, so
   `<Lazy ref={...} />` never populates the ref at all.
2. Even with ref forwarding, a component that has not finished loading has no handle. Any open
   issued before the chunk resolves hits `ref.current === null` and is silently dropped — a
   dead click, and only on a cold cache, which is exactly where nobody tests.

So the wrapper has to preserve the *handle contract*, not just the element. Three pieces:
export a `{...props, innerRef}` variant from the heavy module (ref-as-a-prop, since dynamic
won't forward), keep a queue of at most one pending call, and flush it from a **callback ref** —
which fires in the commit phase once `useImperativeHandle` has run, so the handle is guaranteed
live at flush time. `close()` before load is a no-op, not an error: nothing is open yet.

Warming the chunk on `requestIdleCallback` after hydration makes the queue a rarely-used safety
net rather than the normal path, while still keeping the parse off the critical path.

**Solution** — `src/features/tasks/components/lazy-task-editor-modal.tsx` (wrapper),
`TaskEditorModalWithInnerRef` export in `src/features/tasks/components/task-editor-modal.tsx`,
call sites in `tasks/page.client.tsx`, `full-calendar.tsx`, `taskboard-dashboard.tsx`.
`__tests__/lazy-task-editor-modal.test.tsx` fires `openWithTask` immediately after render —
before the chunk can resolve — and asserts the editor ends up open and populated.

**Rule** — Before wrapping a component in `next/dynamic`, check how it is opened. If callers
drive it through a ref instead of a prop, `dynamic()` alone silently drops the first
interaction: `next/dynamic` does not forward refs, and an unloaded component has no handle.
Pass the ref as a prop, queue the imperative call, and replay it from a callback ref. Always
write the test that calls the handle *before* the chunk resolves — that is the only path that
regresses, and it never shows up in manual testing on a warm cache.

**Dead ends**
- Rendering the lazy modal unconditionally with `ssr: false` and no queue. It removes the
  bundle cost but keeps the dropped-first-click bug; the failure is just rare enough to ship.
- Assuming the chunk is warm because a `useEffect` preloads it. The effect and a fast user
  click race, and on a throttled connection the user wins.
- Grepping the analyzer output for `task-editor-modal` to confirm the split worked — it also
  matches `lazy-task-editor-modal`, so the check reports "still on the critical path" when only
  the 1.2 kB wrapper is left. Match on size, or on the exact module path.
