# Checking off a repeating task must finish one occurrence, not the series

**Problem** — Building a daily list surfaced that every checkbox in the app (`toggleTaskCompletion`) sets `completed = true` on the task row. For a repeating task ("Vitamins, daily") that ends the whole series: it vanishes from every future day.

**Approach** — Looked for an existing per-day mechanism before inventing a column: `task_occurrence_exceptions` already stores per-date overrides with a `skip` flag, `getTaskForOccurrence` already hides skipped days, and the route has POST (upsert) and an unused DELETE. The trap is in the POST route: it writes `override_hour_slot = body.overrideHourSlot ?? null`, and `applyOccurrenceAdjustments` treats a *null* override slot as "taken off the timeline today" and hides the occurrence. So "un-done" via `POST {skip:false}` would still hide the day.

**Solution** — `setOccurrenceDone(task, date, done)` in `src/hooks/use-task-occurrence-exceptions.ts`: done → POST `skip: true` carrying any existing overrides; undone → DELETE the exception, or re-POST `skip:false` with the existing overrides and `task.hourSlot` when the day had real overrides. Exposed via the tasks context; the Today view (`src/features/tasks/today-plan.ts`) counts a skipped occurrence of a repeating task as done today. No migration needed.

**Rule** — Before any write that toggles state on a repeating task, decide whether it applies to the series or the occurrence; a daily list means the occurrence. When re-using an upsert route to *clear* a flag, read how the route fills the fields you didn't send — a `?? null` default can mean something to the reader. Undo by deleting the exception row, not by upserting its negation.

**Dead ends** — Adding a `completed` column to exceptions (needs a live-DB migration the user must run, and the feature breaks until they do). Advancing the due date to the next occurrence Todoist-style (erases the past occurrences from the calendar, since recurrence is anchored on the due date). Treating any null from `getTaskForOccurrence` as "done" — an override slot of null also returns null, so it would mislabel unscheduled days as finished; read `exception.skip` directly.

Known gap: `skip` also means "deleted this occurrence", so a day deleted from the calendar shows as done in Today. The other checkboxes (calendar side panel, dashboard) still complete the series.
