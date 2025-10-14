-- Fix user_preferences_history column naming to match trigger expectations
-- The trigger is looking for 'old_widgets' but the column is 'old_widgets_by_bucket'

-- Add the old_widgets column if it doesn't exist (for backward compatibility)
ALTER TABLE IF EXISTS public.user_preferences_history
  ADD COLUMN IF NOT EXISTS old_widgets JSONB;

-- Add the new_widgets column if it doesn't exist (for backward compatibility)
ALTER TABLE IF EXISTS public.user_preferences_history
  ADD COLUMN IF NOT EXISTS new_widgets JSONB;

-- Add comments
COMMENT ON COLUMN public.user_preferences_history.old_widgets
  IS 'Legacy column name for old_widgets_by_bucket - kept for trigger compatibility';

COMMENT ON COLUMN public.user_preferences_history.new_widgets
  IS 'Legacy column name for new_widgets_by_bucket - kept for trigger compatibility';
