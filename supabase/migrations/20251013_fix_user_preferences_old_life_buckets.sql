-- Fix old_life_buckets column type in user_preferences table
-- The error shows the column is jsonb[] but code is sending jsonb
-- This migration changes it to JSONB to match what the application sends

-- First, check if the column exists in user_preferences (not just history)
DO $$ 
BEGIN
  -- If old_life_buckets exists in user_preferences, change its type
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_preferences' 
    AND column_name = 'old_life_buckets'
  ) THEN
    -- Convert jsonb[] to jsonb by converting to text first
    ALTER TABLE public.user_preferences 
      ALTER COLUMN old_life_buckets TYPE JSONB USING to_jsonb(old_life_buckets);
    
    RAISE NOTICE 'Changed old_life_buckets type to JSONB in user_preferences';
  END IF;
END $$;

-- Also fix it in user_preferences_history if it exists there
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_preferences_history' 
    AND column_name = 'old_life_buckets'
  ) THEN
    -- Convert jsonb[] to jsonb by wrapping the array in a jsonb object
    ALTER TABLE public.user_preferences_history 
      ALTER COLUMN old_life_buckets TYPE JSONB USING to_jsonb(old_life_buckets);
    
    RAISE NOTICE 'Changed old_life_buckets type to JSONB in user_preferences_history';
  END IF;
END $$;

-- Update comments
COMMENT ON COLUMN public.user_preferences_history.old_life_buckets
  IS 'Previous life buckets snapshot (JSONB format)';
