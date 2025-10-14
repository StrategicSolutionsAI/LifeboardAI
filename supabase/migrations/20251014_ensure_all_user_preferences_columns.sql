-- Ensure all required columns exist in user_preferences table
-- This migration is idempotent and safe to run multiple times

-- Add bucket_colors column if it doesn't exist
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS bucket_colors JSONB DEFAULT '{}'::jsonb;

-- Add progress_by_widget column if it doesn't exist
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS progress_by_widget JSONB DEFAULT '{}'::jsonb;

-- Add hourly_plan column if it doesn't exist
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS hourly_plan JSONB DEFAULT '{}'::jsonb;

-- Add indices for better performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_bucket_colors
ON public.user_preferences USING GIN (bucket_colors);

CREATE INDEX IF NOT EXISTS idx_user_preferences_progress_by_widget
ON public.user_preferences USING GIN (progress_by_widget);

CREATE INDEX IF NOT EXISTS idx_user_preferences_hourly_plan
ON public.user_preferences USING GIN (hourly_plan);

-- Verify the columns exist
DO $$ 
BEGIN
  -- Check bucket_colors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_preferences' 
    AND column_name = 'bucket_colors'
  ) THEN
    RAISE EXCEPTION 'bucket_colors column was not created';
  END IF;
  
  -- Check progress_by_widget
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_preferences' 
    AND column_name = 'progress_by_widget'
  ) THEN
    RAISE EXCEPTION 'progress_by_widget column was not created';
  END IF;
  
  -- Check hourly_plan
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_preferences' 
    AND column_name = 'hourly_plan'
  ) THEN
    RAISE EXCEPTION 'hourly_plan column was not created';
  END IF;
  
  RAISE NOTICE 'All required columns exist in user_preferences table';
END $$;
