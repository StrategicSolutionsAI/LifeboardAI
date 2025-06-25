-- Adds progress_by_widget JSONB column to store per-widget progress
alter table if exists user_preferences
add column if not exists progress_by_widget jsonb default '{}'::jsonb; 