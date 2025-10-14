-- Add RLS policies for user_preferences_history table
-- This table is populated by triggers, so we need to allow service role to insert

-- First, ensure RLS is enabled
ALTER TABLE public.user_preferences_history ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own history
CREATE POLICY IF NOT EXISTS "Users can view their own preferences history" 
ON public.user_preferences_history
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow authenticated users to insert history records (triggered by changes)
-- This is needed because the trigger runs in the context of the authenticated user
CREATE POLICY IF NOT EXISTS "Users can insert their own preferences history" 
ON public.user_preferences_history
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow system/triggers to insert history records
-- This bypasses RLS for service role operations
CREATE POLICY IF NOT EXISTS "Service role can insert preferences history" 
ON public.user_preferences_history
FOR INSERT 
WITH CHECK (true);

-- Note: We don't allow UPDATE or DELETE on history table to maintain audit trail
