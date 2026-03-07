-- Add default_assignee column to calendar_imports
-- Stores the family member ID to assign to all events from this import
ALTER TABLE calendar_imports ADD COLUMN IF NOT EXISTS default_assignee text;
