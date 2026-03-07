-- ============================================================================
-- Add updated_at column to cycle_tracking (was missing from original migration)
-- The API does upserts on this table, so we need to track when records change.
-- ============================================================================

ALTER TABLE cycle_tracking
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill existing rows: set updated_at = created_at
UPDATE cycle_tracking SET updated_at = created_at WHERE updated_at IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE cycle_tracking ALTER COLUMN updated_at SET NOT NULL;

-- Auto-update trigger
CREATE OR REPLACE FUNCTION set_cycle_tracking_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_cycle_tracking_updated_at
  BEFORE UPDATE ON cycle_tracking
  FOR EACH ROW
  EXECUTE FUNCTION set_cycle_tracking_updated_at();
