# Whole-day differences must round, not floor, across DST

**Problem** — Weekly recurring tasks created before mid-March vanished from the schedule views until November (found while extracting the recurrence check for the reminder cron).

**Approach** — The weekly rule was `diffDays % 7 === 0 && day === dueDay` with `diffDays = Math.floor((target - due) / 86_400_000)` on local-midnight `Date`s. A span containing the spring-forward day is 23 hours short of whole days (13.96 → 13), so `13 % 7 !== 0`. Fall-back spans are an hour *long* (14.04 → 14), which is why only the spring half broke. Reproduced with a test that sets `process.env.TZ = 'America/Chicago'` and checks 2026-03-01 → 03-15.

**Solution** — `src/lib/task-recurrence.ts` uses `Math.round`; the check moved out of `useTaskViews` so views and the reminder sweep share it (`src/lib/__tests__/task-recurrence.test.ts`).

**Rule** — When counting whole days between two local dates, use `Math.round`, or do the arithmetic on UTC-noon dates (`Date.parse(`${d}T12:00:00Z`)`). Any date test that matters must pin `TZ` to a zone with DST, or it passes on a UTC CI box and fails for users.

**Dead ends** — Testing only in UTC (no DST, so the bug is invisible). Relying on `day === dueDay` alone would also have worked but hides the intent; the rounding fix keeps both checks honest.
