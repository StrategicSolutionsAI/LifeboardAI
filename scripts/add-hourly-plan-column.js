// Script to add hourly_plan column to user_preferences table in Supabase
// Run with: node scripts/add-hourly-plan-column.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function addHourlyPlanColumn() {
  // Create Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials. Please check your .env file.');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔄 Connecting to Supabase...');
  
  try {
    console.log('\n📋 INSTRUCTIONS:\n');
    console.log('To add the hourly_plan column to your user_preferences table:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Click on "SQL Editor" in the left sidebar');
    console.log('3. Create a new query');
    console.log('4. Paste the following SQL:');
    console.log('\n   ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS hourly_plan JSONB DEFAULT \'{}\';\n');
    console.log('5. Click "Run" to execute the query');
    console.log('\nAfter running this SQL command, your hourly planner data will be properly saved to Supabase.\n');
    
    // For environments where direct SQL execution is possible:
    if (process.env.NODE_ENV === 'development' && process.env.SUPABASE_SERVICE_KEY) {
      console.log('🔄 Attempting to add the column automatically...');
      
      // Using raw SQL query with postgrest-js
      const { error } = await supabase
        .from('user_preferences')
        .select('user_id')
        .limit(1);
      
      if (error) {
        console.error('❌ Error connecting to Supabase:', error);
        console.log('Please use the manual SQL instructions above.');
        process.exit(1);
      }
      
      console.log('✅ Connected to Supabase successfully!');
      console.log('⚠️ However, column alterations require direct SQL execution in the Supabase dashboard.');
      console.log('Please follow the manual instructions above.');
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    console.log('Please use the manual SQL instructions above.');
    process.exit(1);
  }
}

addHourlyPlanColumn();
