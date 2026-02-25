// Quick script to check user preferences in database
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUserData() {
  try {
    // Get all user preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*');
    
    if (error) {
      console.error('Error fetching preferences:', error);
      return;
    }
    
    console.log('\n=== User Preferences Data ===');
    data.forEach(pref => {
      console.log(`\nUser ID: ${pref.user_id}`);
      console.log('Life Buckets:', pref.life_buckets);
      console.log('Life Buckets Type:', typeof pref.life_buckets);
      console.log('Life Buckets Value:', JSON.stringify(pref.life_buckets, null, 2));
      console.log('Bucket Colors:', pref.bucket_colors);
      console.log('Widgets by Bucket Keys:', Object.keys(pref.widgets_by_bucket || {}));
    });
  } catch (err) {
    console.error('Exception:', err);
  }
}

checkUserData();
