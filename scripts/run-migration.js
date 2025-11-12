const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250111_create_tournament_messages.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    console.log('Running migration...')

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      console.error('Error running migration:', error)
      process.exit(1)
    }

    console.log('Migration completed successfully!')
    process.exit(0)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

runMigration()
