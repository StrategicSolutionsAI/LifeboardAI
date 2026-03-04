import { supabase } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface UserPreferences {
  id?: string;
  user_id: string;
  life_buckets: string[];
  bucket_colors?: Record<string, string>;
  widgets_by_bucket: Record<string, any[]>;
  progress_by_widget?: Record<string, any>;
  hourly_plan?: Record<string, any[]>;
  selected_theme?: Record<string, any> | null;
  custom_themes?: Record<string, any>[];
  mood_entries?: Record<string, any>;
  calendar_stickers?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Deduplicated auth helper — avoids redundant getUser() network round-trips.
// Multiple call sites share a single in-flight promise within a short window.
// ---------------------------------------------------------------------------
let _authFlight: Promise<User | null> | null = null
let _authCache: { user: User | null; ts: number } | null = null
const AUTH_CACHE_TTL = 30_000 // 30 seconds

/** Get the current Supabase user with deduplication + caching. */
export async function getCachedUser(): Promise<User | null> {
  if (_authCache && Date.now() - _authCache.ts < AUTH_CACHE_TTL) {
    return _authCache.user
  }
  if (_authFlight) return _authFlight

  _authFlight = (async () => {
    // getSession() reads from local storage (fast), getUser() hits the server
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData?.session?.user ?? null
    if (user) {
      _authCache = { user, ts: Date.now() }
      _authFlight = null
      return user
    }
    // Fallback to getUser() if session is stale
    const { data: directUser } = await supabase.auth.getUser()
    const resolved = directUser?.user ?? null
    _authCache = { user: resolved, ts: Date.now() }
    _authFlight = null
    return resolved
  })()

  return _authFlight
}

/** Invalidate the cached auth user (call on sign-out). */
export function invalidateAuthCache() {
  _authCache = null
  _authFlight = null
}

// ---------------------------------------------------------------------------
// In-flight deduplication + short-lived cache for getUserPreferencesClient().
// Multiple components calling this within the same tick (or TTL window) share
// a single Supabase round-trip instead of each firing their own query.
// ---------------------------------------------------------------------------
let _prefsCache: { data: UserPreferences | null; ts: number } | null = null
let _prefsFlight: Promise<UserPreferences | null> | null = null
const PREFS_CACHE_TTL = 60_000 // 60 seconds

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
  const user = await getCachedUser();

  if (!user) {
    console.warn('getUserPreferencesClient: no authenticated user');
    return null;
  }

  const defaults: UserPreferences = {
    user_id: user.id,
    life_buckets: [],
    bucket_colors: {},
    widgets_by_bucket: {},
    progress_by_widget: {},
    hourly_plan: {}
  };

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      // No rows found — return defaults immediately and create row in background
      void supabase
        .from('user_preferences')
        .insert(defaults)
        .select()
        .single()
        .then(({ error: insertError }) => {
          if (insertError) console.error('Error creating initial preferences:', insertError);
        });

      return defaults;
    }

    if (error) {
      console.error('Error fetching user preferences:', error);
      return defaults;
    }

    return {
      ...data,
      bucket_colors: data.bucket_colors || {},
      widgets_by_bucket: data.widgets_by_bucket || {},
      progress_by_widget: data.progress_by_widget || {},
      hourly_plan: data.hourly_plan || {}
    };
  } catch (err) {
    console.error('Exception fetching user preferences:', err);
    return defaults;
  }
}

/**
 * Update only specific fields on the user_preferences row without touching
 * other columns. This avoids race conditions where concurrent full-row
 * upserts overwrite each other's changes.
 */
export async function updateUserPreferenceFields(
  fields: Partial<Pick<UserPreferences, 'life_buckets' | 'bucket_colors' | 'widgets_by_bucket' | 'progress_by_widget' | 'hourly_plan' | 'selected_theme' | 'custom_themes' | 'mood_entries' | 'calendar_stickers'>>
): Promise<boolean> {
  invalidatePreferencesCache()
  try {
    const user = await getCachedUser();
    if (!user) {
      console.warn('updateUserPreferenceFields: no authenticated user');
      return false;
    }

    // Use .select() so we can verify at least one row was updated
    const { data, error } = await supabase
      .from('user_preferences')
      .update(fields)
      .eq('user_id', user.id)
      .select();

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
    const safePreferences: Record<string, any> = {
      user_id: preferences.user_id,
      life_buckets: preferences.life_buckets || [],
      bucket_colors: preferences.bucket_colors || {},
      widgets_by_bucket: preferences.widgets_by_bucket || {},
      progress_by_widget: preferences.progress_by_widget || {},
      hourly_plan: preferences.hourly_plan || {},
    };
    if (preferences.selected_theme !== undefined) {
      safePreferences.selected_theme = preferences.selected_theme;
    }
    if (preferences.custom_themes !== undefined) {
      safePreferences.custom_themes = preferences.custom_themes;
    }
    if (preferences.mood_entries !== undefined) {
      safePreferences.mood_entries = preferences.mood_entries;
    }
    if (preferences.calendar_stickers !== undefined) {
      safePreferences.calendar_stickers = preferences.calendar_stickers;
    }

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
