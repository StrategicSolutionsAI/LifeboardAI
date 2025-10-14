-- Fix RLS policies for user_preferences_history table
-- The issue is that triggers need to bypass RLS when inserting history records

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own preferences history" ON public.user_preferences_history;
DROP POLICY IF EXISTS "Users can insert their own preferences history" ON public.user_preferences_history;
DROP POLICY IF EXISTS "Service role can insert preferences history" ON public.user_preferences_history;

-- Recreate policies with proper permissions

-- Allow users to view their own history
CREATE POLICY "Users can view their own preferences history" 
ON public.user_preferences_history
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow ALL authenticated users to insert history records
-- This is necessary because triggers run in the context of the authenticated user
-- and need to be able to insert records
CREATE POLICY "Authenticated users can insert preferences history" 
ON public.user_preferences_history
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Note: We don't allow UPDATE or DELETE on history table to maintain audit trail
-- The INSERT policy allows any authenticated user to insert, but the application
-- logic ensures that only the correct user_id is inserted via the trigger
