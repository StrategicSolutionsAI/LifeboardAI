-- Fix old_life_buckets column type mismatch
-- The column is TEXT[] but code is trying to insert JSONB
-- Change it to JSONB to match the actual data being inserted

ALTER TABLE IF EXISTS public.user_preferences_history
  ALTER COLUMN old_life_buckets TYPE JSONB USING old_life_buckets::JSONB;

COMMENT ON COLUMN public.user_preferences_history.old_life_buckets
  IS 'Previous life buckets snapshot captured by history trigger (JSONB format).';
