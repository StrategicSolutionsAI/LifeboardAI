-- ============================================================================
-- Add CHECK constraint on kanban_status to prevent invalid values.
-- Previously only enforced at the application level.
-- ============================================================================

ALTER TABLE lifeboard_tasks
  ADD CONSTRAINT lifeboard_tasks_kanban_status_check
  CHECK (kanban_status IN ('todo', 'in_progress', 'done'));
