-- ============================================================================
-- Enable RLS on widget_progress_history (was missing from original migration)
-- This is a critical security fix — without RLS any authenticated user could
-- read other users' widget progress data via direct Supabase client calls.
-- ============================================================================

ALTER TABLE widget_progress_history ENABLE ROW LEVEL SECURITY;

-- Users can only read their own progress history
CREATE POLICY "widget_progress_history_select_own"
  ON widget_progress_history FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own progress history
CREATE POLICY "widget_progress_history_insert_own"
  ON widget_progress_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own progress history
CREATE POLICY "widget_progress_history_update_own"
  ON widget_progress_history FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own progress history
CREATE POLICY "widget_progress_history_delete_own"
  ON widget_progress_history FOR DELETE
  USING (auth.uid() = user_id);
