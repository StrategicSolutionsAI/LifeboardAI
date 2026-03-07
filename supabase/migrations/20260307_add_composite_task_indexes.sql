-- ============================================================================
-- Add composite indexes for the most common task query patterns.
-- The tasks API frequently filters on (user_id, completed, due_date) together
-- but only had separate indexes on (user_id, due_date) and (user_id, completed).
-- ============================================================================

-- Covers: GET tasks where completed=false AND due_date/start_date = X
CREATE INDEX IF NOT EXISTS idx_lifeboard_tasks_user_completed_due
  ON lifeboard_tasks (user_id, completed, due_date);

-- Covers: assignee filtering on tasks page
CREATE INDEX IF NOT EXISTS idx_lifeboard_tasks_user_assignee
  ON lifeboard_tasks (user_id, assignee_id)
  WHERE assignee_id IS NOT NULL;
