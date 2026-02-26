import { supabase } from "@/utils/supabase/client";

export interface UserPreferences {
  id?: string;
  user_id: string;
  life_buckets: string[];
  bucket_colors?: Record<string, string>;
  widgets_by_bucket: Record<string, any[]>;
  progress_by_widget?: Record<string, any>;
  hourly_plan?: Record<string, any[]>;
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// In-flight deduplication + short-lived cache for getUserPreferencesClient().
// Multiple components calling this within the same tick (or TTL window) share
// a single Supabase round-trip instead of each firing their own query.
// ---------------------------------------------------------------------------
let _prefsCache: { data: UserPreferences | null; ts: number } | null = null
let _prefsFlight: Promise<UserPreferences | null> | null = null
const PREFS_CACHE_TTL = 5_000 // 5 seconds

/** Invalidate the in-memory preferences cache (call after saves). */
export function invalidatePreferencesCache() {
  _prefsCache = null
  _prefsFlight = null
}

export async function getUserPreferencesClient() {
  // Return cached result if still fresh
  if (_prefsCache && Date.now() - _prefsCache.ts < PREFS_CACHE_TTL) {
    return _prefsCache.data
  }
  // Deduplicate concurrent in-flight requests
  if (_prefsFlight) return _prefsFlight

  _prefsFlight = _fetchPreferencesClient().then((result) => {
    _prefsCache = { data: result, ts: Date.now() }
    _prefsFlight = null
    return result
  }).catch((err) => {
    _prefsFlight = null
    throw err
  })

  return _prefsFlight
}

async function _fetchPreferencesClient() {
  const { data: sessionData } = await supabase.auth.getSession();
  let user = sessionData?.session?.user ?? null;

  if (!user) {
    const { data: directUser } = await supabase.auth.getUser();
    user = directUser?.user ?? null;
  }

  if (!user) {
    console.warn('getUserPreferencesClient: no authenticated user');
    return null;
  }

  // Check if user_preferences table exists
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // No rows found, create initial preferences
      const initialPrefs = {
        user_id: user.id,
        life_buckets: [],
        bucket_colors: {},
        widgets_by_bucket: {},
        progress_by_widget: {},
        hourly_plan: {}
      };
      
      const { data: newData, error: insertError } = await supabase
        .from('user_preferences')
        .insert(initialPrefs)
        .select()
        .single();
        
      if (insertError) {
        console.error('Error creating initial preferences:', insertError);
        return {
          user_id: user.id,
          life_buckets: [],
          bucket_colors: {},
          widgets_by_bucket: {},
          progress_by_widget: {},
          hourly_plan: {}
        };
      }
      
      return newData;
    }
    
    if (error) {
      // Table might not exist or other error
      console.error('Error fetching user preferences:', error);
      return {
        user_id: user.id,
        life_buckets: [],
        bucket_colors: {},
        widgets_by_bucket: {},
        progress_by_widget: {}
      };
    }
    
    // Ensure required fields are present
    return {
      ...data,
      bucket_colors: data.bucket_colors || {},
      widgets_by_bucket: data.widgets_by_bucket || {},
      progress_by_widget: data.progress_by_widget || {},
      hourly_plan: data.hourly_plan || {}
    };
  } catch (err) {
    console.error('Exception fetching user preferences:', err);
    return {
      user_id: user.id,
      life_buckets: [],
      bucket_colors: {},
      widgets_by_bucket: {},
      progress_by_widget: {},
      hourly_plan: {}
    };
  }
}

/**
 * Update only specific fields on the user_preferences row without touching
 * other columns. This avoids race conditions where concurrent full-row
 * upserts overwrite each other's changes.
 */
export async function updateUserPreferenceFields(
  fields: Partial<Pick<UserPreferences, 'life_buckets' | 'bucket_colors' | 'widgets_by_bucket' | 'progress_by_widget' | 'hourly_plan'>>
): Promise<boolean> {
  invalidatePreferencesCache()
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    let user = sessionData?.session?.user ?? null;
    if (!user) {
      const { data: directUser } = await supabase.auth.getUser();
      user = directUser?.user ?? null;
    }
    if (!user) {
      console.warn('updateUserPreferenceFields: no authenticated user');
      return false;
    }

    // Use .select() so we can verify at least one row was updated
    const { data, error } = await supabase
      .from('user_preferences')
      .update(fields)
      .eq('user_id', user.id)
      .select('user_id');

    if (error) {
      console.error('Error in updateUserPreferenceFields:', error);
      return false;
    }

    // If .update() matched 0 rows the row doesn't exist yet — fall back to
    // a full upsert so the data is not silently lost.
    if (!data || data.length === 0) {
      console.warn('updateUserPreferenceFields: 0 rows matched, falling back to upsert');
      const { error: upsertError } = await supabase
        .from('user_preferences')
        .upsert(
          { user_id: user.id, ...fields },
          { onConflict: 'user_id' }
        )
        .select();
      if (upsertError) {
        console.error('Fallback upsert failed:', upsertError);
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error('Exception in updateUserPreferenceFields:', err);
    return false;
  }
}

/**
 * Save user preferences to Supabase with enhanced error handling and logging
 *
 * @param preferences UserPreferences object to save
 * @returns Promise<boolean> indicating success or failure
 */
export async function saveUserPreferences(preferences: UserPreferences) {
  invalidatePreferencesCache()
  try {
    // Only include fields that exist in the database schema
    // Exclude id, created_at, updated_at as they are auto-managed
    const safePreferences = {
      user_id: preferences.user_id,
      life_buckets: preferences.life_buckets || [],
      bucket_colors: preferences.bucket_colors || {},
      widgets_by_bucket: preferences.widgets_by_bucket || {},
      progress_by_widget: preferences.progress_by_widget || {},
      hourly_plan: preferences.hourly_plan || {},
    };
    
    // Verify data is properly structured before saving
    if (!safePreferences.user_id) {
      console.error('Cannot save preferences - user_id is missing');
      return false;
    }
    
    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        safePreferences,
        { onConflict: 'user_id' }
      )
      .select();
    
    if (error) {
      console.error('Error saving user preferences to Supabase:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Exception saving user preferences:', err);
    return false;
  }
}
