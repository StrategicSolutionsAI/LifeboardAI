// Check user_preferences_history for backup data
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHistory() {
  try {
    const { data, error } = await supabase
      .from('user_preferences_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No history records found');
      return;
    }
    
    console.log(`\nFound ${data.length} history records:`);
    data.forEach((record, i) => {
      console.log(`\n--- Record ${i + 1} (${record.created_at}) ---`);
      console.log('Old buckets:', record.old_life_buckets);
      console.log('New buckets:', record.new_life_buckets);
      console.log('Action:', record.action);
    });
    
  } catch (err) {
    console.error('Exception:', err);
  }
}

checkHistory();
