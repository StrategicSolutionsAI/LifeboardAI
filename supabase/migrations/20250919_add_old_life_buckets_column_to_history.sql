-- Ensure user_preferences_history captures prior life bucket state
ALTER TABLE IF EXISTS public.user_preferences_history
  ADD COLUMN IF NOT EXISTS old_life_buckets TEXT[];

COMMENT ON COLUMN public.user_preferences_history.old_life_buckets
  IS 'Previous life buckets snapshot captured by history trigger.';
