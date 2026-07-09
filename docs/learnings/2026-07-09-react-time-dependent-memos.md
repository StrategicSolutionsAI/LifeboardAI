# Time-dependent values in React memos and render-synced refs go stale

**Problem** — Converting `todayStrGlobal` from a module constant to a function didn't fix midnight staleness where it was called *inside* `useMemo` bodies (no time signal in deps ⇒ memo never re-runs after rollover). Separately, `incrementProgress` built its POST value from a ref that syncs on render — the first increment after midnight posted yesterday's count + 1 while the UI showed 1.

**Approach** — For each `todayStrGlobal()` call site, classify the execution context: (a) event handlers / async callbacks — compute fresh at call time, already correct; (b) `useMemo`/render-derived values — need a reactive date in the dependency array; (c) values read from a render-synced ref inside a callback — the ref holds *pre-update* state, so any transformation the setState updater applies (like a date-rollover reset) must be applied to the ref value too.

**Solution** — New `src/hooks/use-today-str.ts`: `useTodayStr()` returns the local date as state, refreshed by a minute interval that no-ops (same-value setState) until the date changes. Used by `widgetProgressStats` and `upcomingTaskGroups` memos and the widget card's `todayVal` memo (added to deps — hook state changes also bypass `React.memo`). In `incrementProgress` (`use-dashboard-widgets.ts`), the POST value now applies the same rollover reset as the state updater: `(prev.date === today ? prev.value : 0) + 1`.

**Rule** — `useMemo` bodies must not call time-reading functions unless a reactive time value is in the deps — use `useTodayStr()` for date keys. When a callback both updates state via an updater *and* sends a derived value elsewhere (POST body, analytics), derive that value with the same transformation from the same snapshot — never from a render-synced ref plus arithmetic.

**Dead ends** — Making `todayStrGlobal` a function was necessary but not sufficient; a call inside a memo is frozen by the deps, same as the old constant. Hoisting the call above the memo doesn't help either — it just moves the staleness to the enclosing render.
