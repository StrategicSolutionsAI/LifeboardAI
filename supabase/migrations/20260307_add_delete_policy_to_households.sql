-- ============================================================================
-- Add DELETE policy to households table (was missing from original migration)
-- Only the household creator can delete the household.
-- ============================================================================

CREATE POLICY "household_delete_own"
  ON households FOR DELETE
  USING (created_by = auth.uid());
