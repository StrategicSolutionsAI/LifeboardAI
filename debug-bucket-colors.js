// Debug script to test bucket color functionality
// Run with: node debug-bucket-colors.js

const { createClient } = require('@supabase/supabase-js');

// These would normally come from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('Missing Supabase environment variables');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!supabaseAnonKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testBucketColors() {
  try {
    // Check if bucket_colors column exists
    console.log('Testing bucket colors functionality...');

    // Try to query user_preferences table
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error querying user_preferences:', error);
      return;
    }

    console.log('User preferences table structure:');
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
      console.log('Has bucket_colors column:', 'bucket_colors' in data[0]);
    } else {
      console.log('No user preferences found');
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

testBucketColors();