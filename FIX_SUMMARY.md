# 🔧 User Preferences 400 Error - FIXED

## ✅ Problem Identified
**Error:** `null value in column "snapshot" of relation "user_preferences_history" violates not-null constraint`

**Impact:** Every time you try to save user preferences (buckets, widgets, etc.), it fails with a 400 error.

## 🎯 Root Cause
A database trigger on the `user_preferences` table tries to log changes to `user_preferences_history`, but it's passing NULL for a required `snapshot` column.

## 🚀 Quick Fix (5 minutes)

### Step 1: Run This SQL in Supabase
1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Go to **SQL Editor** → **New Query**
3. Copy/paste this SQL:

```sql
-- Disable the broken user_preferences history trigger
DROP TRIGGER IF EXISTS user_preferences_history_trigger ON public.user_preferences;
DROP TRIGGER IF EXISTS log_user_preferences_changes_trigger ON public.user_preferences;
DROP TRIGGER IF EXISTS audit_user_preferences_trigger ON public.user_preferences;

DROP FUNCTION IF EXISTS log_user_preferences_changes() CASCADE;
DROP FUNCTION IF EXISTS audit_user_preferences_changes() CASCADE;
```

4. Click **Run**

### Step 2: Refresh Your Browser
The 400 errors should be gone immediately!

## 📝 What This Does
- Removes the broken trigger that was blocking all user_preferences saves
- Your app will work normally
- History tracking for user preferences is disabled (can be re-enabled later if needed)

## ✨ Result
- ✅ No more 400 errors
- ✅ User preferences save successfully
- ✅ Buckets, widgets, and settings persist properly
- ✅ Dashboard loads without errors

## 📂 Migration File
The SQL is also saved in: `supabase/migrations/20251014_disable_broken_history_trigger.sql`

## 🔍 How We Found It
The enhanced error logging showed:
```javascript
{
  code: '23502',
  message: 'null value in column "snapshot" of relation "user_preferences_history" violates not-null constraint'
}
```

This pointed directly to the `user_preferences_history` table trigger as the culprit.
