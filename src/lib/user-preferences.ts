import { supabase } from "@/utils/supabase/client";

export interface UserPreferences {
  id?: string;
  user_id: string;
  life_buckets: string[];
  widgets_by_bucket: Record<string, any[]>;
  progress_by_widget?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export async function getUserPreferencesClient() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
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
      console.log('No preferences found, creating initial record...');
      
      const initialPrefs = {
        user_id: user.id,
        life_buckets: [],
        widgets_by_bucket: {},
        progress_by_widget: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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
          widgets_by_bucket: {},
          progress_by_widget: {}
        };
      }
      
      console.log('Created initial preferences record');
      return newData;
    }
    
    if (error) {
      // Table might not exist or other error
      console.error('Error fetching user preferences:', error);
      return {
        user_id: user.id,
        life_buckets: [],
        widgets_by_bucket: {},
        progress_by_widget: {}
      };
    }
    
    // Ensure widgets_by_bucket is present
    return {
      ...data,
      widgets_by_bucket: data.widgets_by_bucket || {},
      progress_by_widget: data.progress_by_widget || {}
    };
  } catch (err) {
    console.error('Exception fetching user preferences:', err);
    return {
      user_id: user.id,
      life_buckets: [],
      widgets_by_bucket: {},
      progress_by_widget: {}
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
    console.log('Saving user preferences to Supabase:', JSON.stringify(preferences));
    
    // Ensure widgets_by_bucket exists and is properly formatted before saving
    const safePreferences = {
      ...preferences,
      widgets_by_bucket: preferences.widgets_by_bucket || {},
      progress_by_widget: preferences.progress_by_widget || {},
      updated_at: new Date().toISOString(),
    };
    
    // Verify data is properly structured before saving
    if (!safePreferences.user_id) {
      console.error('Cannot save preferences - user_id is missing');
      return false;
    }
    
    // Log the actual data being saved
    console.log('Safe preferences being saved:', safePreferences);
    
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(
        safePreferences,
        { onConflict: 'user_id' }
      );
    
    if (error) {
      console.error('Error saving user preferences to Supabase:', error);
      return false;
    }
    
    console.log('✅ Successfully saved user preferences to Supabase');
    return true;
  } catch (err) {
    console.error('Exception saving user preferences:', err);
    return false;
  }
}
