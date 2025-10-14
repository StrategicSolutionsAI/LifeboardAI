-- Ensure user_preferences_history has an actor column for auditing
ALTER TABLE IF EXISTS public.user_preferences_history
  ADD COLUMN IF NOT EXISTS actor TEXT;

COMMENT ON COLUMN public.user_preferences_history.actor
  IS 'Identifier of the user or process that changed the preferences.';
