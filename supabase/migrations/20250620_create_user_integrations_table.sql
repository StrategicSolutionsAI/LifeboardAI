-- Create user_integrations table to store OAuth tokens and integration data
CREATE TABLE IF NOT EXISTS public.user_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Add RLS policies
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- Users can read their own integrations
CREATE POLICY "Users can view their own integrations" ON public.user_integrations
  FOR SELECT USING (auth.uid() = user_id);

-- Only authorized functions can insert/update integrations
CREATE POLICY "Users can insert their own integrations" ON public.user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations" ON public.user_integrations
  FOR UPDATE USING (auth.uid() = user_id);

-- Add indices for better query performance
CREATE INDEX ON public.user_integrations (user_id);
CREATE INDEX ON public.user_integrations (provider);
