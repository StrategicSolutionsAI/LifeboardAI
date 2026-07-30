# A prefetch that warmed a cache key nothing ever read

**Problem** — /calendar fired a Google Calendar request at module-evaluation time to warm the cache,
and then fetched the same kind of data again as soon as the component mounted. Both requests
succeeded, so nothing surfaced as broken.

**Approach** — The prefetch and the consumer build their cache keys independently, so the only
question that matters is whether the two strings are equal. Traced both:

- prefetch (`OptimizedCalendarView.tsx`): `calendar-google-month-${startOfMonth}-${endOfMonth}`,
  hardcoded to "this month".
- consumer (`use-calendar-events.ts`): `calendar-google-${view}-${startKey}-${endKey}`.

So the keys match only when `view === 'month'` and the visible range is the current month. Followed
`view` to its initialiser in `use-calendar-navigation.ts`: it restores from `localStorage` and
**defaults to `'day'`** — and `currentDate` is likewise restored from `localStorage`, so it need not
be in this month at all. The prefetch therefore missed for every default-state visit: one wasted
Google Calendar API call, and the mount still paid a cold fetch.

The generalisable part: this is not a typo, it is a *duplication*. Any prefetch that reconstructs a
key by re-deriving the consumer's inputs will drift the moment either side changes.

**Solution** — Moved the range switch, the key builder, and the two `localStorage` readers into
`src/features/calendar/date-range.ts`, and pointed all three call sites at it:
`use-calendar-events.ts` (range + key), `use-calendar-navigation.ts` (the `useState` initialisers),
and the prefetch in `OptimizedCalendarView.tsx`. The prefetch now asks the same helpers what the
calendar will mount with, so the keys cannot disagree. `src/features/calendar/__tests__/date-range.test.ts`
pins the key format and asserts the default-state key is day-scoped, not month-scoped.

Two things fell out of moving the readers to module-evaluation scope: `parseISO` returns an
*Invalid Date* instead of throwing, so the old `try/catch` around it never caught anything and a
corrupt entry would have produced a `NaN` key — now checked with `Number.isNaN`. And `localStorage`
access itself throws when a browser blocks storage; at module scope that takes out the whole chunk
rather than one component, so the reads are wrapped.

**Rule** — A prefetch and the hook it warms must obtain their cache key from the *same exported
function*, never from two copies of the derivation. When adding a prefetch, verify the key by
finding the consumer's key expression and confirming it is the identical call — a prefetch whose
key is a hardcoded guess about default state is worse than no prefetch, because it costs a request
and silently delivers nothing.

**The second half of the same bug** — fixing the `view` segment moved the defect to the `date`
segment, and only adversarial review caught it. `useCalendarNavigation` prefers its
`propSelectedDate` over the stored date, and `OptimizedCalendarView` *always* passes one
(`useState(new Date())`), so reading the stored date was wrong too: anyone who had left the calendar
on another day got a miss again. The prefetch and that `useState` now share one
`initialCalendarDate()` in the same file. Lesson: when a consumer's state has a prop-over-storage
precedence, the prefetch must mirror the precedence, not just the storage.

**Making the key live also made the prefetch's error handling load-bearing** — the fetcher swallowed
failures into `[]`, which React Query stores as a *successful* result for the full 5-minute
staleTime. Harmless while the key was dead; with a live key a single 500 or 5 s timeout hid every
Google Calendar event for five minutes with no retry. All three prefetches in the file now let
failures reject, so React Query records an error, caches nothing, and the mounting hook refetches
with its own fetcher — the one that knows a 401 means "not connected" rather than "broken".
Pinned by `src/hooks/__tests__/use-data-cache-prefetch.test.tsx`.

**Rule (addendum)** — Whenever you make a previously-dead prefetch key live, re-read its fetcher's
error paths first. A `catch { return [] }` in a prefetch is a cache-poisoning bug the moment
something reads the key.

**Dead ends**
- Reading the prefetch and concluding it worked because the key "looks like" the consumer's format.
  The format was right; the `view` segment was wrong.
- Replicating the mobile auto-switch-to-agenda rule in the prefetch. Two reviewers flagged the
  prefetch as "wasted on mobile" because `use-calendar-display` switches a <=640px viewport to
  agenda right after mount. It is not wasted, but not for the reason first assumed (that the stored
  view is already `agenda`): the hook's *first* render still uses the stored view and fetches that
  key, then the switch fetches the agenda key. Two requests happen either way, so prefetching
  either key saves exactly one. Predicting the switch buys nothing.
