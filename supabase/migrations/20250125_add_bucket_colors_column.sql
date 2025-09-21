-- Add bucket_colors column to user_preferences table
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS bucket_colors JSONB DEFAULT '{}'::jsonb;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_bucket_colors
ON user_preferences USING GIN (bucket_colors);