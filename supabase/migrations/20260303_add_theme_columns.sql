-- Add theme columns to user_preferences for cross-device theme sync
ALTER TABLE IF EXISTS user_preferences
ADD COLUMN IF NOT EXISTS selected_theme JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS custom_themes JSONB DEFAULT '[]'::jsonb;
