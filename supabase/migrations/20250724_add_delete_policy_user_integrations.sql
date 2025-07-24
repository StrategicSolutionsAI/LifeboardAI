-- Add missing DELETE policy for user_integrations table
-- This allows users to delete their own integrations (disconnect functionality)

CREATE POLICY "Users can delete their own integrations" ON public.user_integrations
  FOR DELETE USING (auth.uid() = user_id);
