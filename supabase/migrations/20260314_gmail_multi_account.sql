-- Enable multiple Gmail accounts per user by relaxing the unique constraint.
-- Old: UNIQUE(user_id, provider) — only one gmail row per user
-- New: UNIQUE(user_id, provider, provider_user_id) — one row per email address

-- Drop the old unique constraint (name may vary by environment)
ALTER TABLE public.user_integrations
  DROP CONSTRAINT IF EXISTS user_integrations_user_id_provider_key;

-- Add the new composite unique constraint
-- provider_user_id stores the Gmail email address for gmail rows
ALTER TABLE public.user_integrations
  ADD CONSTRAINT user_integrations_user_provider_account_key
  UNIQUE (user_id, provider, provider_user_id);
