-- Add assignee_id to tasks and shopping list items
-- Stores the family member UUID from the Family Members widget
ALTER TABLE lifeboard_tasks ADD COLUMN IF NOT EXISTS assignee_id text NULL;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS assignee_id text NULL;
