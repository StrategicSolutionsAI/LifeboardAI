// Restore buckets from bucket_colors
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function restoreBuckets() {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .single();
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    // Get all bucket names from bucket_colors
    const allBuckets = Object.keys(data.bucket_colors || {});
    
    console.log('\nCurrent buckets:', data.life_buckets);
    console.log('\nBuckets found in colors:', allBuckets);
    console.log('\nMissing buckets:', allBuckets.filter(b => !data.life_buckets.includes(b)));
    
    // Ask for confirmation
    console.log('\n⚠️  This will restore ALL bucket names from your bucket_colors.');
    console.log('⚠️  However, widgets for missing buckets are likely lost.');
    console.log('\nWould restore buckets to:', allBuckets);
    
    // Update buckets
    const { error: updateError } = await supabase
      .from('user_preferences')
      .update({ life_buckets: allBuckets })
      .eq('user_id', data.user_id);
    
    if (updateError) {
      console.error('Update error:', updateError);
    } else {
      console.log('\n✅ Buckets restored! Refresh your browser to see all tabs.');
    }
    
  } catch (err) {
    console.error('Exception:', err);
  }
}

restoreBuckets();
