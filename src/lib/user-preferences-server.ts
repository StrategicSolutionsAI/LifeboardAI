import { supabaseServer } from "@/utils/supabase/server";

export interface UserPreferences {
  id?: string;
  user_id: string;
  life_buckets: string[];
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
      // No rows found, return empty preferences
      return {
        user_id: user.id,
        life_buckets: [],
      } as UserPreferences;
    }
    
    if (error) {
      // Table might not exist or other error
      console.error('Error fetching user preferences:', error);
      return {
        user_id: user.id,
        life_buckets: [],
      } as UserPreferences;
    }
    
    return data as UserPreferences;
  } catch (err) {
    console.error('Exception fetching user preferences:', err);
    return {
      user_id: user.id,
      life_buckets: [],
    } as UserPreferences;
  }
}
