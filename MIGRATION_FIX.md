# Fix for User Preferences 400 Error

## Problem
The app is showing repeated errors:
```
Error saving user preferences to Supabase: 
null value in column "snapshot" of relation "user_preferences_history" violates not-null constraint
```

## Root Cause ✅ IDENTIFIED
The `user_preferences_history` table has a trigger that's trying to insert history records with a NULL `snapshot` column, but the column has a NOT NULL constraint. This breaks every user_preferences save operation.

## Solution - QUICK FIX (Recommended)

### Run This Migration in Supabase Dashboard:
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to: **SQL Editor** → **New Query**
4. Copy and paste the contents of: `supabase/migrations/20251014_disable_broken_history_trigger.sql`
5. Click **Run** to execute the migration
6. **Refresh your browser** - errors should be gone immediately!

This disables the broken history trigger. Your app will work normally, just without history tracking for user preferences changes.

## Verification
After running the migration:
1. Visit: http://localhost:3000/api/admin/check-schema
2. Verify `status: "OK"` and `missingColumns: []`
3. Refresh your app - the 400 errors should be gone

## What the Migration Does
```sql
-- Disables the broken history trigger
DROP TRIGGER IF EXISTS user_preferences_history_trigger ON public.user_preferences;
DROP FUNCTION IF EXISTS log_user_preferences_changes() CASCADE;
```

This removes the trigger that was causing the NOT NULL constraint violation.

## Files Created
- `supabase/migrations/20251014_disable_broken_history_trigger.sql` - **THE FIX** (run this!)
- `supabase/migrations/20251014_fix_user_preferences_history_snapshot.sql` - Alternative fix
- `src/app/api/admin/check-schema/route.ts` - Schema checker endpoint
- Enhanced logging in `src/lib/user-preferences.ts` for debugging

## Why This Happened
A database trigger on `user_preferences` table tries to log changes to `user_preferences_history`, but the trigger function is passing NULL for a required `snapshot` column. The trigger was likely created directly in Supabase and isn't in the migration files.
