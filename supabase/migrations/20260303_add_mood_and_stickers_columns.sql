ALTER TABLE IF EXISTS user_preferences
ADD COLUMN IF NOT EXISTS mood_entries JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS calendar_stickers JSONB DEFAULT '{}'::jsonb;
