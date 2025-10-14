const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  try {
    console.log('🔧 Fixing RLS policies for user_preferences_history...\n')
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/20251013_fix_user_preferences_history_rls.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Migration file loaded successfully\n')
    console.log('⚙️  Executing migration statements...\n')
    
    // Split into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        // Filter out empty statements and comment-only lines
        if (!stmt) return false
        const lines = stmt.split('\n').filter(line => !line.trim().startsWith('--'))
        return lines.some(line => line.trim().length > 0)
      })
    
    let successCount = 0
    let errorCount = 0
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      const preview = statement.substring(0, 60).replace(/\n/g, ' ')
      console.log(`   [${i + 1}/${statements.length}] ${preview}...`)
      
      try {
        // Use the REST API directly via fetch since RPC doesn't work
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ query: statement + ';' })
        })
        
        if (!response.ok) {
          // Try alternative: use pg_stat_statements or direct query
          console.log(`   ⚠️  Trying alternative method...`)
          
          // For policy operations, we need to use the SQL editor in Supabase dashboard
          // or use a PostgreSQL client directly
          console.log(`   ℹ️  This statement needs to be run in Supabase SQL Editor`)
          errorCount++
        } else {
          console.log(`   ✓ Success`)
          successCount++
        }
      } catch (err) {
        console.error(`   ❌ Error: ${err.message}`)
        errorCount++
      }
    }
    
    console.log(`\n📊 Results: ${successCount} succeeded, ${errorCount} need manual execution`)
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some statements could not be executed automatically.')
      console.log('📋 Please run the following SQL in your Supabase SQL Editor:')
      console.log('   Dashboard → SQL Editor → New Query\n')
      console.log('─'.repeat(60))
      console.log(migrationSQL)
      console.log('─'.repeat(60))
      console.log('\n🔗 Supabase Dashboard: https://supabase.com/dashboard/project/_/sql')
    } else {
      console.log('\n✅ All RLS policies fixed!')
      console.log('\nThe user_preferences_history table now allows:')
      console.log('  • Users can view their own history')
      console.log('  • Authenticated users can insert history records (via triggers)')
      console.log('  • No UPDATE or DELETE allowed (audit trail protection)')
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    if (error.stack) {
      console.error('\nStack trace:', error.stack)
    }
    
    console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:')
    console.log('─'.repeat(60))
    const migrationPath = path.join(__dirname, '../supabase/migrations/20251013_fix_user_preferences_history_rls.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    console.log(migrationSQL)
    console.log('─'.repeat(60))
    
    process.exit(1)
  }
}

runMigration()
