-- Weight (and any fractional metric) widgets post decimal values; the int
-- column rejects them (22P02), so POST /api/widgets/progress 500s on every
-- dashboard load and fractional progress is never saved.
alter table widget_progress_history
    alter column value type numeric using value::numeric;
