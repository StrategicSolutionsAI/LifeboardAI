-- Add provider_user_id to support Withings webhook lookup
ALTER TABLE IF EXISTS public.user_integrations
ADD COLUMN IF NOT EXISTS provider_user_id TEXT;

-- Helpful index for webhook/provider lookups
CREATE INDEX IF NOT EXISTS user_integrations_provider_user_idx
  ON public.user_integrations (provider, provider_user_id);

