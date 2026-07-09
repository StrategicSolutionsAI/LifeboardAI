# dynamic(ssr:false) chunks are invisible to Link prefetch — warm them on hover

**Problem** — Hovering the sidebar's Dashboard/Tasks links warmed route + data, yet the click still stalled: the 214KB taskboard chunk and the three tasks view chunks only started downloading after the navigation committed.

**Approach** — `<Link>` prefetch covers the route's RSC payload and route-level bundles, but chunks created by `dynamic(..., { ssr: false })` load only when the component actually renders. The repo already had the fix pattern for calendar (`src/lib/prefetch-calendar.ts`): on hover, call `import()` with the **exact same module specifier** the page uses — webpack resolves it to the same chunk, so the download happens during the hover→click gap and the page-level `import()` resolves instantly from the module cache.

**Solution** — `src/lib/prefetch-dashboard.ts` (new), `prefetchTasksExperience()` in `src/lib/prefetch-tasks.ts`, `src/lib/prefetch-notes.ts` (data-only twin), wired into the warm handlers in `src/components/sidebar-layout.tsx` (commit 2730a54).

**Rule** — When a route hides its real UI behind `dynamic(ssr:false)`, give its nav link a hover/focus/touchstart handler that `import()`s the identical specifiers; identical strings matter, or webpack creates a different chunk reference. Verify with two production-build browser contexts sharing `storageState` but not HTTP cache: in the warm context, hover then click and count new `/_next/static/` requests after the click; in the control context, trigger the click with `locator.dispatchEvent('click')` — a physical `page.click()` moves the mouse and fires `mouseenter`, contaminating the control with the very warm handler under test. Warm click should need strictly fewer chunks (measured here: tasks 0 vs 12, dashboard 7 vs 12).

**Dead ends** — Trying to identify hashed prod chunk names to assert on specific files (differential counting between warm/control contexts is simpler and robust); asserting in dev mode where chunk names are readable but Link prefetch is disabled, so the baseline doesn't match production.
