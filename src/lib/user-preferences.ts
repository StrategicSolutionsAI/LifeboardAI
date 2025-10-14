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

export async function getUserPreferencesClient() {
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
 * Save user preferences to Supabase with enhanced error handling and logging
 * 
 * @param preferences UserPreferences object to save
 * @returns Promise<boolean> indicating success or failure
 */
export async function saveUserPreferences(preferences: UserPreferences) {
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
    
    // Debug logging - show actual data structure
    console.log('Attempting to save preferences:', {
      user_id: safePreferences.user_id,
      life_buckets: safePreferences.life_buckets,
      bucket_colors: safePreferences.bucket_colors,
      widgets_by_bucket_sample: Object.keys(safePreferences.widgets_by_bucket).slice(0, 2),
      progress_by_widget_sample: Object.keys(safePreferences.progress_by_widget).slice(0, 2),
      hourly_plan_sample: Object.keys(safePreferences.hourly_plan).slice(0, 2),
    });
    
    const { data, error } = await supabase
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
    
    console.log('Successfully saved preferences:', data);
    return true;
  } catch (err) {
    console.error('Exception saving user preferences:', err);
    return false;
  }
}
