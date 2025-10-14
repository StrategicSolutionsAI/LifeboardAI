-- Fix user_preferences_history snapshot column constraint
-- The error: 'null value in column "snapshot" of relation "user_preferences_history" violates not-null constraint'
-- This happens when the trigger tries to insert history records

-- Option 1: Make snapshot column nullable if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_preferences_history' 
    AND column_name = 'snapshot'
  ) THEN
    ALTER TABLE public.user_preferences_history 
      ALTER COLUMN snapshot DROP NOT NULL;
    
    RAISE NOTICE 'Made snapshot column nullable in user_preferences_history';
  ELSE
    RAISE NOTICE 'snapshot column does not exist in user_preferences_history';
  END IF;
END $$;

-- Option 2: If the trigger is causing issues, we can disable it temporarily
-- Uncomment these lines if needed:
-- DROP TRIGGER IF EXISTS user_preferences_history_trigger ON public.user_preferences;
-- DROP FUNCTION IF EXISTS log_user_preferences_changes();

-- List all columns in user_preferences_history for debugging
DO $$
DECLARE
  col_record RECORD;
BEGIN
  RAISE NOTICE 'Columns in user_preferences_history:';
  FOR col_record IN 
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_preferences_history'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  - %: % (nullable: %)', col_record.column_name, col_record.data_type, col_record.is_nullable;
  END LOOP;
END $$;
