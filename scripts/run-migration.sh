#!/bin/bash

# Script to run the user_preferences columns migration
# This fixes the 400 error when saving user preferences

echo "🔧 Running user_preferences columns migration..."
echo ""
echo "Please run this SQL in your Supabase SQL Editor:"
echo "https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new"
echo ""
echo "----------------------------------------"
cat supabase/migrations/20251014_ensure_all_user_preferences_columns.sql
echo "----------------------------------------"
echo ""
echo "After running the migration, refresh your app to test."
