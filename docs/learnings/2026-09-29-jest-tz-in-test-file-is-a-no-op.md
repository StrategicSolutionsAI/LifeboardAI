# Setting process.env.TZ in a Jest test file does nothing

**Problem** — The first push to main failed CI in `src/lib/__tests__/tasks-query.test.ts`: expected `completedSince=2026-09-28T05:00Z` (Chicago midnight), received `T00:00Z` (UTC midnight). The same 325 tests passed on the Mac, and the file starts with `process.env.TZ = 'America/Chicago'`.

**Approach** — A local-pass/CI-fail date test points at the machine's zone, so reran the whole suite with `TZ=UTC npx jest`: exactly that test failed, reproducing CI. The in-file assignment was clearly not applying. Under Jest each test environment gets its own copy of `process.env`, so the assignment never reaches Node's real environment, and Node only resets its time-zone cache when the real `TZ` changes. Six test files used the same line; the other five passed in UTC only because their assertions hold in any zone — which means the DST regression tests in `task-recurrence` and `use-calendar-events` had never exercised a DST change in CI.

**Solution** — `jest.global-setup.js` sets `process.env.TZ = 'America/Chicago'` and `jest.config.js` registers it as `globalSetup`. Global setup runs in the parent process before any test, so both worker mode and `--runInBand` (CI) inherit the zone. Verified: 321 passed under `TZ=UTC` parallel, `TZ=UTC --runInBand`, and the local zone.

**Rule** — Never pin a time zone inside a Jest test file; the global setup already pins America/Chicago for every test. To check that a date test really depends on its zone, run it with `TZ=UTC` — if it still passes, it isn't testing the local-vs-UTC difference you think it is.

**Dead ends** — Making the expected value zone-independent (`new Date(2026, 8, 28).toISOString()`) would pass everywhere and test nothing: in UTC, local midnight and UTC midnight are the same instant.
