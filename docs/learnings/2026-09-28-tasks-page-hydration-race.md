# "Text content does not match server-rendered HTML" on /tasks is a prefetch race

**Problem** — After a change to the task fetch, the Next dev overlay showed "2 errors" on every warm reload of /tasks: "Text content does not match server-rendered HTML" and "There was an error while hydrating this Suspense boundary". It looked like the change had caused it.

**Approach** — Ruled out the new view first: `TodayView` is `dynamic(..., { ssr: false })`, which renders the same loading fallback on server and client, so it can't mismatch. That left the page shell (`src/app/(app)/tasks/page.client.tsx`), whose header ("N open · M done") and stat tiles render from `allTasks`. `prefetchAllTasks()` runs at module evaluation into the shared React Query client, and /tasks has a `loading.tsx` Suspense boundary that can hydrate after that prefetch resolves — so the server HTML says "0 open" while the first client render already says "28 open". The browser console tool didn't capture React's warning, and rule 2 forbids a second dev server, so bisected in place: temporarily pointed the one changed module back at the old URL, reloaded twice, and the error still appeared on the warm reload. Then restored the file.

**Solution** — None yet; pre-existing and timing-dependent (a cold dev compile makes the prefetch slower than hydration, which hides it). The fix is to render the shell's counts only after mount, or to render the data-dependent shell client-only like the tab views.

**Rule** — A hydration error on a page whose data is prefetched at module load is the prefetch winning the race against a Suspense boundary, not the latest edit — confirm by reverting only the suspected module in place and reloading twice (the first, cold load often hides it). Never render cache-derived text in SSR'd markup on these pages.

**Dead ends** — Reading console messages through the browser extension (React's mismatch warning never arrived). Starting a second dev server on another port to compare commits (rule 2).
