-- Disable the broken user_preferences history trigger
-- Error: 'null value in column "snapshot" of relation "user_preferences_history" violates not-null constraint'
-- This trigger is causing all user_preferences updates to fail

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS user_preferences_history_trigger ON public.user_preferences;
DROP TRIGGER IF EXISTS log_user_preferences_changes_trigger ON public.user_preferences;
DROP TRIGGER IF EXISTS audit_user_preferences_trigger ON public.user_preferences;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS log_user_preferences_changes() CASCADE;
DROP FUNCTION IF EXISTS audit_user_preferences_changes() CASCADE;

-- Log what we did
DO $$
BEGIN
  RAISE NOTICE 'Disabled user_preferences history trigger to fix 400 errors';
  RAISE NOTICE 'User preferences can now be saved without history tracking';
  RAISE NOTICE 'History tracking can be re-enabled later after fixing the trigger function';
END $$;
