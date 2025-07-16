-- Adds hourly_plan JSONB column to store per-day hourly planner data
ALTER TABLE IF EXISTS user_preferences
ADD COLUMN IF NOT EXISTS hourly_plan JSONB DEFAULT '{}'::jsonb; 