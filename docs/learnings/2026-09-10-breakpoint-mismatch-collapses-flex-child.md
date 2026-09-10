# A JS media query and a Tailwind breakpoint disagreed, and a flex child collapsed to 0px

**Problem** — Between 768px and 1023px the /calendar page showed only the habit/task panel; the month grid was missing entirely. Phones (agenda view) and desktops were fine, so nobody saw it.

**Approach**
1. Measured instead of eyeballing: in an 820px same-origin iframe, `getBoundingClientRect()` on the two children of the calendar row gave heights 0 and 830. The grid was rendered but had no height.
2. Read the container: `flex flex-col lg:flex-row h-full`; calendar child `flex-1 min-h-0`; panel `flex-shrink-0 w-full lg:w-[360px]`.
3. Read the guard that hides the panel: `window.matchMedia('(max-width: 640px)')`. The row layout starts at `lg` (1024px), so from 641px to 1023px the panel mounted, stacked, refused to shrink, and took all the height; `min-h-0` let the calendar drop to 0.

**Solution** — `src/app/(app)/calendar/OptimizedCalendarView.tsx`: the media query now matches the same breakpoint as the layout (`max-width: 1023px`), so the panel exists only when it sits beside the calendar. Commit 9be85d7.

**Rule** — A JS `matchMedia` that decides what to mount must use the same breakpoint as the Tailwind classes that decide how it is laid out. When a fixed-height flex column stacks a `flex-shrink-0` sibling next to a `flex-1 min-h-0` child, test the width band between the two breakpoints, not just phone and desktop.

**Dead ends**
- Blaming the month grid's own CSS. Its container had 0px before the grid ever got a chance.
- Looking for a bug only at 390px and 1456px; the defect lives only in the middle band.
