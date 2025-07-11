-- Add hourly_plan column to user_preferences table
-- Run this in the Supabase SQL Editor

-- Add the column if it doesn't exist
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS hourly_plan JSONB DEFAULT '{}';

-- Verify the column was added
SELECT 
  column_name, 
  data_type 
FROM 
  information_schema.columns 
WHERE 
  table_name = 'user_preferences' AND 
  column_name = 'hourly_plan';
