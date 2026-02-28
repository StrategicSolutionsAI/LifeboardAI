-- Fix overly permissive INSERT policy on user_preferences_history
-- Previous migration used WITH CHECK (true) which allows any authenticated user
-- to insert records for ANY user_id, bypassing the audit trail integrity.
--
-- The trigger that populates this table runs in the context of the authenticated
-- user who is updating their own preferences. Since RLS on user_preferences
-- already ensures users can only update their own rows, the user_id in the
-- triggered insert will always match auth.uid().

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can insert preferences history"
  ON public.user_preferences_history;

-- Recreate with proper user_id check
CREATE POLICY "Authenticated users can insert own preferences history"
  ON public.user_preferences_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
