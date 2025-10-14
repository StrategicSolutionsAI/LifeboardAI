-- Align user_preferences_history schema with auditing trigger expectations
ALTER TABLE IF EXISTS public.user_preferences_history
  ADD COLUMN IF NOT EXISTS new_life_buckets TEXT[],
  ADD COLUMN IF NOT EXISTS old_widgets_by_bucket JSONB,
  ADD COLUMN IF NOT EXISTS new_widgets_by_bucket JSONB,
  ADD COLUMN IF NOT EXISTS old_progress_by_widget JSONB,
  ADD COLUMN IF NOT EXISTS new_progress_by_widget JSONB,
  ADD COLUMN IF NOT EXISTS old_bucket_colors JSONB,
  ADD COLUMN IF NOT EXISTS new_bucket_colors JSONB,
  ADD COLUMN IF NOT EXISTS old_hourly_plan JSONB,
  ADD COLUMN IF NOT EXISTS new_hourly_plan JSONB;

COMMENT ON COLUMN public.user_preferences_history.new_life_buckets
  IS 'Life buckets after the change.';
COMMENT ON COLUMN public.user_preferences_history.old_widgets_by_bucket
  IS 'Widget assignments per bucket before the change.';
COMMENT ON COLUMN public.user_preferences_history.new_widgets_by_bucket
  IS 'Widget assignments per bucket after the change.';
COMMENT ON COLUMN public.user_preferences_history.old_progress_by_widget
  IS 'Widget progress payload before the change.';
COMMENT ON COLUMN public.user_preferences_history.new_progress_by_widget
  IS 'Widget progress payload after the change.';
COMMENT ON COLUMN public.user_preferences_history.old_bucket_colors
  IS 'Bucket color mapping prior to the change.';
COMMENT ON COLUMN public.user_preferences_history.new_bucket_colors
  IS 'Bucket color mapping after the change.';
COMMENT ON COLUMN public.user_preferences_history.old_hourly_plan
  IS 'Hourly plan before the change.';
COMMENT ON COLUMN public.user_preferences_history.new_hourly_plan
  IS 'Hourly plan after the change.';
