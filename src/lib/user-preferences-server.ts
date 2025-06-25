import { supabaseServer } from "@/utils/supabase/server";

export interface UserPreferences {
  id?: string;
  user_id: string;
  life_buckets: string[];
  widgets_by_bucket: Record<string, any[]>;
  progress_by_widget?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export async function getUserPreferencesServer() {
  const supabase = supabaseServer();
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
          progress_by_widget: {},
        } as UserPreferences;
      }
      
      console.log('Created initial preferences record');
      return newData as UserPreferences;
    }
    
    if (error) {
      // Table might not exist or other error
      console.error('Error fetching user preferences:', error);
      return {
        user_id: user.id,
        life_buckets: [],
        widgets_by_bucket: {},
        progress_by_widget: {},
      } as UserPreferences;
    }
    
    return {
      ...data,
      widgets_by_bucket: data.widgets_by_bucket || {},
      progress_by_widget: data.progress_by_widget || {}
    } as UserPreferences;
  } catch (err) {
    console.error('Exception fetching user preferences:', err);
    return {
      user_id: user.id,
      life_buckets: [],
      widgets_by_bucket: {},
      progress_by_widget: {},
    } as UserPreferences;
  }
}
