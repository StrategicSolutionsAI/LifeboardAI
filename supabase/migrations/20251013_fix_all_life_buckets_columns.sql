-- Fix all life_buckets related columns to use JSONB instead of TEXT[]
-- This resolves type mismatch errors where code sends JSONB but columns expect TEXT[]

-- Fix new_life_buckets in user_preferences_history
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_preferences_history' 
    AND column_name = 'new_life_buckets'
    AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE public.user_preferences_history 
      ALTER COLUMN new_life_buckets TYPE JSONB USING to_jsonb(new_life_buckets);
    
    RAISE NOTICE 'Changed new_life_buckets type to JSONB in user_preferences_history';
  END IF;
END $$;

-- Fix old_life_buckets in user_preferences_history (if still TEXT[])
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_preferences_history' 
    AND column_name = 'old_life_buckets'
    AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE public.user_preferences_history 
      ALTER COLUMN old_life_buckets TYPE JSONB USING to_jsonb(old_life_buckets);
    
    RAISE NOTICE 'Changed old_life_buckets type to JSONB in user_preferences_history';
  END IF;
END $$;

-- Fix old_life_buckets in user_preferences (if it exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_preferences' 
    AND column_name = 'old_life_buckets'
  ) THEN
    -- Check if it's an array type
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'user_preferences' 
      AND column_name = 'old_life_buckets'
      AND data_type = 'ARRAY'
    ) THEN
      ALTER TABLE public.user_preferences 
        ALTER COLUMN old_life_buckets TYPE JSONB USING to_jsonb(old_life_buckets);
      
      RAISE NOTICE 'Changed old_life_buckets type to JSONB in user_preferences';
    END IF;
  END IF;
END $$;

-- Update comments
COMMENT ON COLUMN public.user_preferences_history.new_life_buckets
  IS 'Life buckets after the change (JSONB format)';

COMMENT ON COLUMN public.user_preferences_history.old_life_buckets
  IS 'Life buckets before the change (JSONB format)';
